import type { EphemeralHost } from 'types/api';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Flex,
  FlexItem,
  InputGroup,
  InputGroupItem,
  TextInput,
  Tooltip,
} from '@patternfly/react-core';
import {
  DownloadIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusCircleIcon,
  TrashIcon,
  UploadIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useLingui } from '@lingui/react/macro';
import { useField } from 'components/Form';
import {
  parseEphemeralHostsCsv,
  SAMPLE_EPHEMERAL_HOSTS_CSV,
  validateEphemeralHosts,
} from './ephemeralHostsUtils';

export interface EphemeralHostsStepProps {
  requireAtLeastOne: boolean;
  showValidation: boolean;
}

const EMPTY_HOST_ROW: EphemeralHost = {
  host: '',
  username: '',
  password: '',
  port: '',
  become_password: '',
};

function EphemeralHostsStep({
  requireAtLeastOne,
  showValidation,
}: EphemeralHostsStepProps) {
  const { t } = useLingui();
  const [field, , helpers] = useField<EphemeralHost[]>('ephemeral_hosts');
  const hosts = Array.isArray(field.value) ? field.value : [];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [revealedPasswords, setRevealedPasswords] = useState<
    Record<string, boolean>
  >({});

  const validation = validateEphemeralHosts(hosts, requireAtLeastOne);

  const updateHosts = (next: EphemeralHost[]) => {
    helpers.setValue(next);
    helpers.setTouched(true, false);
  };

  const handleAddRow = () => {
    setCsvErrors([]);
    updateHosts([...hosts, { ...EMPTY_HOST_ROW }]);
  };

  const handleRemoveRow = (index: number) => {
    const next = hosts.filter((_, idx) => idx !== index);
    updateHosts(next);
  };

  const handleClearAll = () => {
    setCsvErrors([]);
    setRevealedPasswords({});
    updateHosts([]);
  };

  const handleFieldChange = (
    index: number,
    key: keyof EphemeralHost,
    value: string
  ) => {
    const next = hosts.map((row, idx) =>
      idx === index ? { ...row, [key]: value } : row
    );
    updateHosts(next);
  };

  const toggleReveal = (key: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = typeof e.target?.result === 'string' ? e.target.result : '';
      const result = parseEphemeralHostsCsv(content);
      setCsvErrors(result.errors);
      if (result.hosts.length > 0) {
        updateHosts(result.hosts);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_EPHEMERAL_HOSTS_CSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ascender_hosts_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div data-cy="ephemeral-hosts-step">
      <Alert
        variant="info"
        isInline
        title={t`Ephemeral target hosts (passwords are never saved)`}
        style={{ marginBottom: '16px' }}
      >
        {t`Enter target VMs manually or import a CSV file (columns: host, user, password, optional port, optional become_password). Credentials are encrypted in transit and wiped from the database as soon as the job starts.`}
      </Alert>

      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        spaceItems={{ default: 'spaceItemsSm' }}
        style={{ marginBottom: '12px' }}
      >
        <FlexItem>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleCsvUpload}
            data-cy="ephemeral-hosts-csv-input"
          />
          <Button
            variant="secondary"
            icon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            data-cy="ephemeral-hosts-import-csv"
          >
            {t`Import CSV`}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="link"
            icon={<DownloadIcon />}
            onClick={handleDownloadSample}
            data-cy="ephemeral-hosts-download-sample"
          >
            {t`Sample CSV`}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="primary"
            icon={<PlusCircleIcon />}
            onClick={handleAddRow}
            data-cy="ephemeral-hosts-add-row"
          >
            {t`Add Host`}
          </Button>
        </FlexItem>
        {hosts.length > 0 && (
          <FlexItem>
            <Button
              variant="link"
              isDanger
              onClick={handleClearAll}
              data-cy="ephemeral-hosts-clear-all"
            >
              {t`Clear All`}
            </Button>
          </FlexItem>
        )}
        <FlexItem align={{ default: 'alignRight' }}>
          <Badge isRead>{t`${hosts.length} host(s)`}</Badge>
        </FlexItem>
      </Flex>

      {csvErrors.length > 0 && (
        <Alert
          variant="danger"
          isInline
          title={t`CSV import error`}
          style={{ marginBottom: '12px' }}
        >
          {csvErrors.map((err, idx) => (
            <div key={idx}>{err}</div>
          ))}
        </Alert>
      )}

      {showValidation && !validation.isValid && (
        <Alert
          variant="danger"
          isInline
          title={t`Validation error`}
          style={{ marginBottom: '12px' }}
        >
          {validation.errors.map((err, idx) => (
            <div key={idx}>{err}</div>
          ))}
        </Alert>
      )}

      {hosts.length === 0 ? (
        <Alert
          variant="warning"
          isInline
          title={t`No target hosts added yet`}
        >
          {t`Click "Add Host" to enter rows manually or "Import CSV" to load hosts from a CSV file.`}
        </Alert>
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <Table variant="compact" aria-label={t`Target hosts table`}>
            <Thead>
              <Tr>
                <Th width={10}>#</Th>
                <Th>{t`Host / IP *`}</Th>
                <Th>{t`Username *`}</Th>
                <Th>{t`Password *`}</Th>
                <Th width={10}>{t`Port`}</Th>
                <Th>{t`Become Password`}</Th>
                <Th screenReaderText={t`Actions`} />
              </Tr>
            </Thead>
            <Tbody>
              {hosts.map((row, index) => {
                const rowErr = showValidation
                  ? validation.rowErrors[index] ?? {}
                  : {};
                const passKey = `pass-${index}`;
                const becomeKey = `become-${index}`;
                return (
                  <Tr key={index} data-cy={`ephemeral-host-row-${index}`}>
                    <Td>{index + 1}</Td>
                    <Td>
                      <TextInput
                        aria-label={t`Host ${index + 1}`}
                        value={row.host}
                        placeholder="10.x.x.x"
                        validated={rowErr.host ? 'error' : 'default'}
                        onChange={(_e, val) =>
                          handleFieldChange(index, 'host', val)
                        }
                      />
                      {rowErr.host && (
                        <div style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: '12px' }}>
                          {rowErr.host}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <TextInput
                        aria-label={t`Username ${index + 1}`}
                        value={row.username}
                        placeholder="root"
                        validated={rowErr.username ? 'error' : 'default'}
                        onChange={(_e, val) =>
                          handleFieldChange(index, 'username', val)
                        }
                      />
                      {rowErr.username && (
                        <div style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: '12px' }}>
                          {rowErr.username}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <InputGroup>
                        <InputGroupItem isFill>
                          <TextInput
                            aria-label={t`Password ${index + 1}`}
                            type={revealedPasswords[passKey] ? 'text' : 'password'}
                            value={row.password}
                            validated={rowErr.password ? 'error' : 'default'}
                            onChange={(_e, val) =>
                              handleFieldChange(index, 'password', val)
                            }
                          />
                        </InputGroupItem>
                        <InputGroupItem>
                          <Tooltip
                            content={
                              revealedPasswords[passKey]
                                ? t`Hide password`
                                : t`Show password`
                            }
                          >
                            <Button
                              variant="control"
                              aria-label={t`Toggle password visibility`}
                              onClick={() => toggleReveal(passKey)}
                            >
                              {revealedPasswords[passKey] ? (
                                <EyeSlashIcon />
                              ) : (
                                <EyeIcon />
                              )}
                            </Button>
                          </Tooltip>
                        </InputGroupItem>
                      </InputGroup>
                      {rowErr.password && (
                        <div style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: '12px' }}>
                          {rowErr.password}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <TextInput
                        aria-label={t`Port ${index + 1}`}
                        value={row.port == null ? '' : String(row.port)}
                        placeholder="22"
                        validated={rowErr.port ? 'error' : 'default'}
                        onChange={(_e, val) =>
                          handleFieldChange(index, 'port', val)
                        }
                      />
                      {rowErr.port && (
                        <div style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: '12px' }}>
                          {rowErr.port}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <InputGroup>
                        <InputGroupItem isFill>
                          <TextInput
                            aria-label={t`Become password ${index + 1}`}
                            type={
                              revealedPasswords[becomeKey] ? 'text' : 'password'
                            }
                            value={row.become_password ?? ''}
                            placeholder={t`Optional`}
                            onChange={(_e, val) =>
                              handleFieldChange(index, 'become_password', val)
                            }
                          />
                        </InputGroupItem>
                        <InputGroupItem>
                          <Tooltip
                            content={
                              revealedPasswords[becomeKey]
                                ? t`Hide become password`
                                : t`Show become password`
                            }
                          >
                            <Button
                              variant="control"
                              aria-label={t`Toggle become password visibility`}
                              onClick={() => toggleReveal(becomeKey)}
                            >
                              {revealedPasswords[becomeKey] ? (
                                <EyeSlashIcon />
                              ) : (
                                <EyeIcon />
                              )}
                            </Button>
                          </Tooltip>
                        </InputGroupItem>
                      </InputGroup>
                    </Td>
                    <Td>
                      <Tooltip content={t`Remove host`}>
                        <Button
                          variant="plain"
                          aria-label={t`Remove host ${index + 1}`}
                          onClick={() => handleRemoveRow(index)}
                        >
                          <TrashIcon />
                        </Button>
                      </Tooltip>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default EphemeralHostsStep;
