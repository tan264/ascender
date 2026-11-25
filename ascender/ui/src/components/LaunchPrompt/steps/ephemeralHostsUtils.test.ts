import { describe, expect, test } from 'vitest';
import {
  parseEphemeralHostsCsv,
  serializeEphemeralHostsForLaunch,
  validateEphemeralHosts,
} from './ephemeralHostsUtils';

describe('ephemeralHostsUtils', () => {
  test('parses CSV with header and optional columns including quoted comma password', () => {
    const csv = [
      'host,user,password,port,become_password',
      '10.155.132.40,root,"P@ss,with,comma",22,',
      '10.155.132.41,admin,"Quote""Pass",2222,SudoSecret',
    ].join('\n');

    const result = parseEphemeralHostsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.hosts).toEqual([
      {
        host: '10.155.132.40',
        username: 'root',
        password: 'P@ss,with,comma',
        port: '22',
        become_password: '',
      },
      {
        host: '10.155.132.41',
        username: 'admin',
        password: 'Quote"Pass',
        port: '2222',
        become_password: 'SudoSecret',
      },
    ]);
  });

  test('parses CSV without header (3 columns)', () => {
    const csv = '10.0.0.1,root,Secret1\n10.0.0.2,ubuntu,Secret2\n';
    const result = parseEphemeralHostsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.hosts).toHaveLength(2);
    expect(result.hosts[0]).toMatchObject({
      host: '10.0.0.1',
      username: 'root',
      password: 'Secret1',
    });
  });

  test('validates duplicate hosts, missing required fields, and invalid ports', () => {
    const res = validateEphemeralHosts(
      [
        { host: '10.0.0.1', username: 'root', password: 'pw1', port: '22' },
        { host: '10.0.0.1', username: '', password: '', port: '99999' },
      ],
      true
    );
    expect(res.isValid).toBe(false);
    expect(res.rowErrors[1].host).toMatch(/Duplicate host/);
    expect(res.rowErrors[1].username).toBeTruthy();
    expect(res.rowErrors[1].password).toBeTruthy();
    expect(res.rowErrors[1].port).toBeTruthy();
  });

  test('serializes payload cleanly stripping empty optional fields', () => {
    const payload = serializeEphemeralHostsForLaunch([
      {
        host: ' 10.0.0.1 ',
        username: ' root ',
        password: 'pw1',
        port: '',
        become_password: '',
      },
      {
        host: '10.0.0.2',
        username: 'admin',
        password: 'pw2',
        port: '2222',
        become_password: 'sudo2',
      },
    ]);
    expect(payload).toEqual([
      { host: '10.0.0.1', username: 'root', password: 'pw1' },
      {
        host: '10.0.0.2',
        username: 'admin',
        password: 'pw2',
        port: 2222,
        become_password: 'sudo2',
      },
    ]);
  });
});
