import type { EphemeralHost } from 'types/api';

export const MAX_EPHEMERAL_HOSTS = 500;

export const SAMPLE_EPHEMERAL_HOSTS_CSV = [
  'host,user,password,port,become_password',
  '10.155.132.40,root,ChangeMe123,22,',
  '10.155.132.41,admin,OtherPass456,2222,SudoPass789',
].join('\n');

export interface CsvParseResult {
  hosts: EphemeralHost[];
  errors: string[];
}

export interface EphemeralHostsValidationResult {
  isValid: boolean;
  errors: string[];
  rowErrors: Record<number, Record<string, string>>;
}

/**
 * RFC-4180 compatible single-line CSV parser supporting quoted fields
 * (including commas and escaped quotes "" inside passwords).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const HEADER_ALIASES: Record<string, keyof EphemeralHost> = {
  host: 'host',
  hostname: 'host',
  ip: 'host',
  ansible_host: 'host',
  user: 'username',
  username: 'username',
  ansible_user: 'username',
  pass: 'password',
  password: 'password',
  ansible_password: 'password',
  port: 'port',
  ansible_port: 'port',
  become_password: 'become_password',
  become_pass: 'become_password',
  sudo_password: 'become_password',
  sudo_pass: 'become_password',
  ansible_become_password: 'become_password',
};

export function parseEphemeralHostsCsv(csvText: string): CsvParseResult {
  const errors: string[] = [];
  const hosts: EphemeralHost[] = [];

  const cleanText = csvText.replace(/^\uFEFF/, '');
  const rawLines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith('#'));

  if (rawLines.length === 0) {
    return { hosts: [], errors: ['CSV file is empty.'] };
  }

  const firstRow = parseCsvLine(rawLines[0]).map((c) => c.trim().toLowerCase());
  const mappedHeaders = firstRow.map((col) => HEADER_ALIASES[col] ?? null);
  const hasHeader =
    mappedHeaders.includes('host') &&
    mappedHeaders.includes('username') &&
    mappedHeaders.includes('password');

  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < rawLines.length; i += 1) {
    const cols = parseCsvLine(rawLines[i]);
    const lineNum = i + 1;

    let entry: EphemeralHost;
    if (hasHeader) {
      const record: Partial<Record<keyof EphemeralHost, string>> = {};
      mappedHeaders.forEach((field, idx) => {
        if (field && idx < cols.length) {
          record[field] = cols[idx];
        }
      });
      entry = {
        host: (record.host ?? '').trim(),
        username: (record.username ?? '').trim(),
        password: record.password ?? '',
        port: (record.port ?? '').trim(),
        become_password: record.become_password ?? '',
      };
    } else {
      if (cols.length < 3) {
        errors.push(
          `Line ${lineNum}: expected at least 3 columns (host, user, password).`
        );
        continue;
      }
      entry = {
        host: (cols[0] ?? '').trim(),
        username: (cols[1] ?? '').trim(),
        password: cols[2] ?? '',
        port: (cols[3] ?? '').trim(),
        become_password: cols[4] ?? '',
      };
    }

    hosts.push(entry);
  }

  if (hosts.length > MAX_EPHEMERAL_HOSTS) {
    errors.push(
      `CSV contains ${hosts.length} hosts, exceeding the limit of ${MAX_EPHEMERAL_HOSTS}.`
    );
  }

  return { hosts, errors };
}

export function validateEphemeralHosts(
  hosts: EphemeralHost[],
  requireAtLeastOne: boolean
): EphemeralHostsValidationResult {
  const errors: string[] = [];
  const rowErrors: Record<number, Record<string, string>> = {};

  if (hosts.length === 0) {
    if (requireAtLeastOne) {
      errors.push(
        'Please add at least one target host manually or import a CSV file.'
      );
    }
    return { isValid: errors.length === 0, errors, rowErrors };
  }

  if (hosts.length > MAX_EPHEMERAL_HOSTS) {
    errors.push(
      `At most ${MAX_EPHEMERAL_HOSTS} hosts are allowed per job launch.`
    );
  }

  const seenHosts = new Map<string, number>();

  hosts.forEach((row, index) => {
    const fieldErrs: Record<string, string> = {};
    const hostVal = (row.host ?? '').trim();
    const userVal = (row.username ?? '').trim();
    const passVal = row.password ?? '';

    if (!hostVal) {
      fieldErrs.host = 'Host / IP is required.';
    } else if (/\s/.test(hostVal)) {
      fieldErrs.host = 'Host must not contain whitespace.';
    } else {
      const key = hostVal.toLowerCase();
      if (seenHosts.has(key)) {
        fieldErrs.host = `Duplicate host (matches row ${(seenHosts.get(key) ?? 0) + 1}).`;
      } else {
        seenHosts.set(key, index);
      }
    }

    if (!userVal) {
      fieldErrs.username = 'Username is required.';
    }

    if (!passVal) {
      fieldErrs.password = 'Password is required.';
    }

    const portRaw =
      row.port === null || typeof row.port === 'undefined'
        ? ''
        : String(row.port).trim();
    if (portRaw !== '') {
      const portNum = Number(portRaw);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        fieldErrs.port = 'Port must be an integer between 1 and 65535.';
      }
    }

    if (Object.keys(fieldErrs).length > 0) {
      rowErrors[index] = fieldErrs;
    }
  });

  if (Object.keys(rowErrors).length > 0) {
    errors.push('One or more host rows have validation errors.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    rowErrors,
  };
}

export function serializeEphemeralHostsForLaunch(
  hosts: EphemeralHost[]
): Array<{
  host: string;
  username: string;
  password: string;
  port?: number;
  become_password?: string;
}> {
  return hosts.map((row) => {
    const payload: {
      host: string;
      username: string;
      password: string;
      port?: number;
      become_password?: string;
    } = {
      host: row.host.trim(),
      username: row.username.trim(),
      password: row.password,
    };
    const portRaw =
      row.port === null || typeof row.port === 'undefined'
        ? ''
        : String(row.port).trim();
    if (portRaw !== '') {
      payload.port = Number(portRaw);
    }
    if (row.become_password) {
      payload.become_password = row.become_password;
    }
    return payload;
  });
}
