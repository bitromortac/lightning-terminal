import { observable, ObservableMap, values } from 'mobx';
import * as LND from 'types/generated/lnd_pb';
import { grpc } from '@improbable-eng/grpc-web';
import { waitFor } from '@testing-library/react';
import Big from 'big.js';
import { BalanceMode } from 'util/constants';
import { lndChannelEvent, lndListChannels } from 'util/tests/sampleData';
import { createStore, Store } from 'store';
import Channel from 'store/models/channel';
import ChannelStore from 'store/stores/channelStore';

const grpcMock = grpc as jest.Mocked<typeof grpc>;

describe('ChannelStore', () => {
  let rootStore: Store;
  let store: ChannelStore;

  const channelSubset = (channels: ObservableMap<string, Channel>) => {
    const few = values(channels)
      .slice(0, 20)
      .reduce((result, c) => {
        result[c.chanId] = c;
        return result;
      }, {} as Record<string, Channel>);
    return observable.map(few);
  };

  beforeEach(() => {
    rootStore = createStore();
    store = rootStore.channelStore;
  });

  it('should fetch list of channels', async () => {
    expect(store.channels.size).toEqual(0);
    await store.fetchChannels();
    expect(store.channels.size).toEqual(lndListChannels.channelsList.length);
  });

  it('should handle errors fetching channels', async () => {
    grpcMock.unary.mockImplementationOnce(desc => {
      if (desc.methodName === 'ListChannels') throw new Error('test-err');
      return undefined as any;
    });
    expect(rootStore.uiStore.alerts.size).toBe(0);
    await store.fetchChannels();
    await waitFor(() => {
      expect(rootStore.uiStore.alerts.size).toBe(1);
      expect(values(rootStore.uiStore.alerts)[0].message).toBe('test-err');
    });
  });

  it('should update existing channels with the same id', async () => {
    expect(store.channels.size).toEqual(0);
    await store.fetchChannels();
    expect(store.channels.size).toEqual(lndListChannels.channelsList.length);
    const prevChan = store.sortedChannels[0];
    const prevUptime = prevChan.uptime;
    prevChan.uptime = Big(123);
    await store.fetchChannels();
    const updatedChan = store.sortedChannels[0];
    // the existing channel should be updated
    expect(prevChan).toBe(updatedChan);
    expect(updatedChan.uptime).toEqual(prevUptime);
  });

  it('should sort channels correctly when using receive mode', async () => {
    await store.fetchChannels();
    rootStore.settingsStore.setBalanceMode(BalanceMode.receive);
    store.channels = channelSubset(store.channels);
    store.sortedChannels.forEach((c, i) => {
      if (i === 0) return;
      expect(c.localPercent).toBeLessThanOrEqual(
        store.sortedChannels[i - 1].localPercent,
      );
    });
  });

  it('should sort channels correctly when using send mode', async () => {
    await store.fetchChannels();
    rootStore.settingsStore.setBalanceMode(BalanceMode.send);
    store.channels = channelSubset(store.channels);
    store.sortedChannels.forEach((c, i) => {
      if (i === 0) return;
      expect(c.localPercent).toBeGreaterThanOrEqual(
        store.sortedChannels[i - 1].localPercent,
      );
    });
  });

  it('should sort channels correctly when using routing mode', async () => {
    await store.fetchChannels();
    rootStore.settingsStore.setBalanceMode(BalanceMode.routing);
    store.channels = channelSubset(store.channels);
    store.sortedChannels.forEach((c, i) => {
      if (i === 0) return;
      const currPct = Math.max(c.localPercent, 99 - c.localPercent);
      const prev = store.sortedChannels[i - 1];
      const prevPct = Math.max(prev.localPercent, 99 - prev.localPercent);
      expect(currPct).toBeLessThanOrEqual(prevPct);
    });
  });

  it('should compute inbound liquidity', async () => {
    await store.fetchChannels();
    const inbound = lndListChannels.channelsList.reduce(
      (sum, chan) => sum + chan.remoteBalance,
      0,
    );

    expect(+store.totalInbound).toBe(inbound);
  });

  it('should compute outbound liquidity', async () => {
    await store.fetchChannels();
    const outbound = lndListChannels.channelsList.reduce(
      (sum, chan) => sum + chan.localBalance,
      0,
    );

    expect(+store.totalOutbound).toBe(outbound);
  });

  describe('onChannelEvent', () => {
    const {
      OPEN_CHANNEL,
      CLOSED_CHANNEL,
      ACTIVE_CHANNEL,
      INACTIVE_CHANNEL,
    } = LND.ChannelEventUpdate.UpdateType;

    beforeEach(async () => {
      await store.fetchChannels();
    });

    it('should handle inactive channel event', async () => {
      const event = { ...lndChannelEvent, type: INACTIVE_CHANNEL };
      const len = lndListChannels.channelsList.length;
      expect(store.activeChannels).toHaveLength(len);
      store.onChannelEvent(event);
      expect(store.activeChannels).toHaveLength(len - 1);
    });

    it('should handle active channel event', async () => {
      await store.fetchChannels();
      const chan = store.channels.get(lndListChannels.channelsList[0].chanId) as Channel;
      chan.active = false;
      const event = { ...lndChannelEvent, type: ACTIVE_CHANNEL };
      const len = lndListChannels.channelsList.length;
      expect(store.activeChannels).toHaveLength(len - 1);
      store.onChannelEvent(event);
      expect(store.activeChannels).toHaveLength(len);
    });

    it('should handle open channel event', async () => {
      const event = { ...lndChannelEvent, type: OPEN_CHANNEL };
      event.openChannel.chanId = '12345';
      expect(store.channels.get('12345')).toBeUndefined();
      store.onChannelEvent(event);
      expect(store.channels.get('12345')).toBeDefined();
    });

    it('should handle close channel event', async () => {
      const event = { ...lndChannelEvent, type: CLOSED_CHANNEL };
      const chanId = event.closedChannel.chanId;
      expect(store.channels.get(chanId)).toBeDefined();
      store.onChannelEvent(event);
      expect(store.channels.get(chanId)).toBeUndefined();
    });

    it('should do nothing for unknown channel event type', async () => {
      const event = { ...lndChannelEvent, type: 99 };
      const len = lndListChannels.channelsList.length;
      expect(store.activeChannels).toHaveLength(len);
      store.onChannelEvent(event as any);
      expect(store.activeChannels).toHaveLength(len);
    });
  });
});
