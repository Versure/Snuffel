import { TestBed } from '@angular/core/testing';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { UserRecord } from '../pocketbase/types';
import { ProgressError } from '../progress/progress-error';
import { AccountsService } from './accounts.service';

const user = (id: string, name: string, username: string, role: UserRecord['role'] = 'child') => ({
  id,
  name,
  username,
  role,
});

describe('AccountsService', () => {
  let client: PocketBase;
  let users: { getFullList: ReturnType<typeof vi.fn>; getOne: ReturnType<typeof vi.fn> };
  let service: AccountsService;

  beforeEach(() => {
    client = new PocketBase('/');
    users = { getFullList: vi.fn(async () => []), getOne: vi.fn() };
    vi.spyOn(client, 'collection').mockImplementation((name: string) => {
      expect(name).toBe('users');
      return users as unknown as ReturnType<PocketBase['collection']>;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: PocketBaseService, useValue: { client } }],
    });
    service = TestBed.inject(AccountsService);
  });

  it('loadChildren asks only children and only id, name, username and role', async () => {
    await service.loadChildren();
    expect(users.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'role = "child"', fields: 'id,name,username,role' }),
    );
  });

  it('loadChildren sorts on name, then username', async () => {
    users.getFullList.mockResolvedValue([
      user('3', 'Zoë', 'zoe'),
      user('2', 'Ånne', 'anne-b'),
      user('1', 'Ånne', 'anne-a'),
      user('4', 'bram', 'bram'),
      user('5', 'Ouder', 'ouder', 'parent'),
    ]);
    const children = await service.loadChildren();
    expect(children.map((child) => child.username)).toEqual(['anne-a', 'anne-b', 'bram', 'zoe']);
  });

  it('loadChild gives null for an unknown id', async () => {
    users.getOne.mockRejectedValue(new ClientResponseError({ status: 404 }));
    await expect(service.loadChild('onbekend')).resolves.toBeNull();
  });

  it('loadChild gives null for a parent', async () => {
    users.getOne.mockResolvedValue(user('p', 'Ouder', 'ouder', 'parent'));
    await expect(service.loadChild('p')).resolves.toBeNull();
    users.getOne.mockResolvedValue(user('a', 'Kind A', 'kind-a'));
    await expect(service.loadChild('a')).resolves.toEqual(user('a', 'Kind A', 'kind-a'));
    expect(users.getOne).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ fields: 'id,name,username,role' }),
    );
  });

  it('a network error becomes ProgressError unavailable', async () => {
    users.getFullList.mockRejectedValue(new ClientResponseError({ status: 0 }));
    users.getOne.mockRejectedValue(new ClientResponseError({ status: 503 }));
    const list = await service.loadChildren().catch((error: unknown) => error);
    const one = await service.loadChild('a').catch((error: unknown) => error);
    for (const error of [list, one]) {
      expect(error).toBeInstanceOf(ProgressError);
      expect((error as ProgressError).reason).toBe('unavailable');
    }
  });
});
