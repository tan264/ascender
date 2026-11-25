import type { EphemeralHost } from 'types/api';
import React from 'react';
import { useLingui } from '@lingui/react/macro';
import { useField } from 'components/Form';
import EphemeralHostsStep from './EphemeralHostsStep';
import StepName from './StepName';
import { validateEphemeralHosts } from './ephemeralHostsUtils';
import type {
  LaunchConfig,
  LaunchStep,
  VisitedSteps,
  LaunchPromptValues,
} from '../types';

const STEP_ID = 'ephemeralHosts';

export default function useEphemeralHostsStep(
  launchConfig: LaunchConfig,
  visitedSteps: VisitedSteps
): LaunchStep {
  const { t } = useLingui();
  const [, meta, helpers] = useField<EphemeralHost[]>('ephemeral_hosts');
  const hosts = Array.isArray(meta.value) ? meta.value : [];
  const requireAtLeastOne = Boolean(
    launchConfig.ask_ephemeral_hosts_on_launch &&
      !launchConfig.ask_inventory_on_launch
  );
  const validation = validateEphemeralHosts(hosts, requireAtLeastOne);
  const isVisited = Object.keys(visitedSteps).includes(STEP_ID);
  const showValidation = Boolean(isVisited || meta.touched);
  const formError = Boolean(
    launchConfig.ask_ephemeral_hosts_on_launch &&
      showValidation &&
      !validation.isValid
  );

  return {
    step: !launchConfig.ask_ephemeral_hosts_on_launch
      ? null
      : {
          id: STEP_ID,
          name: (
            <StepName hasErrors={formError} id="ephemeral-hosts-step">
              {t`Target Hosts`}
            </StepName>
          ),
          component: (
            <EphemeralHostsStep
              requireAtLeastOne={requireAtLeastOne}
              showValidation={showValidation}
            />
          ),
          enableNext: true,
        },
    initialValues: getInitialValues(launchConfig),
    isReady: true,
    contentError: null,
    hasError: formError,
    setTouched: (
      setFieldTouched: (
        field: string,
        touched?: boolean,
        shouldValidate?: boolean
      ) => void
    ) => {
      setFieldTouched('ephemeral_hosts', true, false);
    },
    validate: () => {
      if (!validation.isValid) {
        helpers.setError(validation.errors[0] || t`Invalid target hosts`);
      } else {
        helpers.setError(undefined);
      }
    },
  };
}

function getInitialValues(launchConfig: LaunchConfig): LaunchPromptValues {
  if (!launchConfig.ask_ephemeral_hosts_on_launch) {
    return {};
  }
  return {
    ephemeral_hosts: [],
  };
}
