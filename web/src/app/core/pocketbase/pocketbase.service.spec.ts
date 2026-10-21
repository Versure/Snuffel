import { TestBed } from '@angular/core/testing';
import { LocalAuthStore } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

describe('PocketBaseService', () => {
  it('is a single instance', () => {
    expect(TestBed.inject(PocketBaseService)).toBe(TestBed.inject(PocketBaseService));
  });

  it('talks to the same origin', () => {
    const { client } = TestBed.inject(PocketBaseService);
    expect(client.baseURL).toBe('/');
    const url = new URL(client.buildURL('/api/health'), window.location.href);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/api/health');
  });

  it('keeps the session in localStorage under pocketbase_auth', () => {
    const { client } = TestBed.inject(PocketBaseService);
    expect(client.authStore).toBeInstanceOf(LocalAuthStore);
    localStorage.clear();
    client.authStore.save('token', null);
    expect(Object.keys(localStorage)).toEqual(['pocketbase_auth']);
    client.authStore.clear();
    expect(localStorage.getItem('pocketbase_auth')).toBeNull();
  });
});
