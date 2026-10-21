import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import PocketBase, { ClientResponseError, LocalAuthStore, type RecordModel } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import { AuthService } from './auth.service';

const storageKey = 'pocketbase_auth';

/** A token with the shape of a PocketBase JWT; only the expiry matters to the client. */
function fakeToken(expiresInSeconds = 3600): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id: 'a1', type: 'auth', exp })}.c2ln`;
}

function userRecord(overrides: Partial<RecordModel> = {}): RecordModel {
  return {
    id: 'a1',
    collectionId: '_pb_users_auth_',
    collectionName: 'users',
    username: 'kind-a',
    name: 'Kind A',
    role: 'child',
    ...overrides,
  };
}

describe('AuthService', () => {
  let client: PocketBase;
  let router: Router;

  function setup(): AuthService {
    client = new PocketBase('/', new LocalAuthStore(storageKey));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PocketBaseService, useValue: { client } }],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts logged out without a session', () => {
    const auth = setup();
    expect(auth.user()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.role()).toBeNull();
  });

  it('picks up a valid session from localStorage', () => {
    localStorage.setItem(storageKey, JSON.stringify({ token: fakeToken(), record: userRecord() }));
    const auth = setup();
    expect(auth.user()).toEqual({ id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' });
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('ignores an expired session', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ token: fakeToken(-60), record: userRecord() }),
    );
    expect(setup().isLoggedIn()).toBe(false);
  });

  it('ignores a session of another collection (for example a superuser)', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        token: fakeToken(),
        record: userRecord({ collectionName: '_superusers', role: undefined }),
      }),
    );
    expect(setup().isLoggedIn()).toBe(false);
  });

  describe('login', () => {
    it('sends the trimmed, lower-case username and fills user', async () => {
      const auth = setup();
      const users = client.collection('users');
      const spy = vi.spyOn(users, 'authWithPassword').mockImplementation(async () => {
        client.authStore.save(fakeToken(), userRecord());
        return { token: client.authStore.token, record: userRecord() };
      });
      const user = await auth.login('  Kind-A ', 'snuffel-test');
      expect(spy).toHaveBeenCalledWith('kind-a', 'snuffel-test');
      expect(user.name).toBe('Kind A');
      expect(auth.user()?.username).toBe('kind-a');
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('does not trim or change the password', async () => {
      const auth = setup();
      const spy = vi
        .spyOn(client.collection('users'), 'authWithPassword')
        .mockRejectedValue(new ClientResponseError({ status: 400 }));
      await expect(auth.login('kind-a', ' Geheim ')).rejects.toBeInstanceOf(ClientResponseError);
      expect(spy).toHaveBeenCalledWith('kind-a', ' Geheim ');
      expect(auth.isLoggedIn()).toBe(false);
    });
  });

  it('logout clears the store and goes to /login', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ token: fakeToken(), record: userRecord() }));
    const auth = setup();
    await auth.logout();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('role follows user', () => {
    const auth = setup();
    expect(auth.role()).toBeNull();
    client.authStore.save(fakeToken(), userRecord({ role: 'parent', name: 'Ouder' }));
    expect(auth.role()).toBe('parent');
    client.authStore.save(fakeToken(), userRecord({ role: 'child' }));
    expect(auth.role()).toBe('child');
    client.authStore.clear();
    expect(auth.role()).toBeNull();
  });

  it('a change in another tab (storage event) updates user', () => {
    localStorage.setItem(storageKey, JSON.stringify({ token: fakeToken(), record: userRecord() }));
    const auth = setup();
    expect(auth.isLoggedIn()).toBe(true);

    // The other tab logs out: localStorage is empty and this tab gets a storage event.
    localStorage.removeItem(storageKey);
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: null }));
    expect(auth.user()).toBeNull();

    // And logs in again as someone else.
    const record = userRecord({ id: 'p1', username: 'ouder', name: 'Ouder', role: 'parent' });
    localStorage.setItem(storageKey, JSON.stringify({ token: fakeToken(), record }));
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
    expect(auth.user()?.name).toBe('Ouder');
    expect(auth.role()).toBe('parent');
  });

  describe('refresh', () => {
    function loggedIn(): AuthService {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ token: fakeToken(), record: userRecord() }),
      );
      return setup();
    }

    it('does nothing without a session', async () => {
      const auth = setup();
      const spy = vi.spyOn(client.collection('users'), 'authRefresh');
      await auth.refresh();
      expect(spy).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('renews the token and updates user', async () => {
      const auth = loggedIn();
      const renewed = userRecord({ name: 'Anna' });
      vi.spyOn(client.collection('users'), 'authRefresh').mockImplementation(async () => {
        client.authStore.save(fakeToken(7200), renewed);
        return { token: client.authStore.token, record: renewed };
      });
      await auth.refresh();
      expect(auth.user()?.name).toBe('Anna');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('clears the session and goes to /login on 401', async () => {
      const auth = loggedIn();
      vi.spyOn(client.collection('users'), 'authRefresh').mockRejectedValue(
        new ClientResponseError({ status: 401 }),
      );
      await auth.refresh();
      expect(auth.isLoggedIn()).toBe(false);
      expect(localStorage.getItem(storageKey)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('clears the session on 403 and 404 too', async () => {
      for (const status of [403, 404]) {
        TestBed.resetTestingModule();
        const auth = loggedIn();
        vi.spyOn(client.collection('users'), 'authRefresh').mockRejectedValue(
          new ClientResponseError({ status }),
        );
        await auth.refresh();
        expect(auth.isLoggedIn()).toBe(false);
      }
    });

    it('keeps the session when the server cannot be reached (status 0)', async () => {
      const auth = loggedIn();
      vi.spyOn(client.collection('users'), 'authRefresh').mockRejectedValue(
        new ClientResponseError({ status: 0, originalError: new TypeError('Failed to fetch') }),
      );
      await auth.refresh();
      expect(auth.isLoggedIn()).toBe(true);
      expect(localStorage.getItem(storageKey)).not.toBeNull();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('keeps the session on a server error (5xx)', async () => {
      const auth = loggedIn();
      vi.spyOn(client.collection('users'), 'authRefresh').mockRejectedValue(
        new ClientResponseError({ status: 503 }),
      );
      await auth.refresh();
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('clears an expired session without asking the server', async () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ token: fakeToken(-60), record: userRecord() }),
      );
      const auth = setup();
      const spy = vi.spyOn(client.collection('users'), 'authRefresh');
      await auth.refresh();
      expect(spy).not.toHaveBeenCalled();
      expect(localStorage.getItem(storageKey)).toBeNull();
    });
  });
});
