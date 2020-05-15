import React from 'react';
import { observable } from 'mobx';
import { SwapDirection } from 'types/state';
import { lndListChannels } from 'util/tests/sampleData';
import { useStore } from 'store';
import SwapWizard from 'components/loop/swap/SwapWizard';

export default {
  title: 'Components/Swap Wizard',
  component: SwapWizard,
  parameters: { contained: true },
  decorators: [
    (StoryFn: any) => (
      <div style={{ padding: 100 }}>
        <StoryFn />
      </div>
    ),
  ],
};

const selectedChannels = observable.array(
  lndListChannels.channelsList.slice(0, 3).map(c => c.chanId),
);

export const Step1Amount = () => {
  const { buildSwapStore: build } = useStore();
  build.startSwap();
  build.selectedChanIds = selectedChannels;
  build.setDirection(SwapDirection.OUT);
  return <SwapWizard />;
};

export const Step2Fees = () => {
  const { buildSwapStore: build } = useStore();
  build.startSwap();
  build.selectedChanIds = selectedChannels;
  build.setDirection(SwapDirection.OUT);
  build.setAmount(500000);
  build.goToNextStep();
  return <SwapWizard />;
};

export const Step3Processing = () => {
  const { buildSwapStore: build } = useStore();
  build.startSwap();
  build.selectedChanIds = selectedChannels;
  build.setDirection(SwapDirection.OUT);
  build.setAmount(500000);
  build.goToNextStep();
  build.goToNextStep();
  return <SwapWizard />;
};
