import * as LND from 'types/generated/lnd_pb';
import { Lightning } from 'types/generated/lnd_pb_service';
import BaseApi from './base';
import GrpcClient from './grpc';

/** the names and argument types for the subscription events */
interface LndEvents {
  transaction: LND.Transaction.AsObject;
  channel: LND.ChannelEventUpdate.AsObject;
}

/**
 * An API wrapper to communicate with the LND node via GRPC
 */
class LndApi extends BaseApi<LndEvents> {
  private _grpc: GrpcClient;

  constructor(grpc: GrpcClient) {
    super();
    this._grpc = grpc;
  }

  /**
   * call the LND `GetInfo` RPC and return the response
   */
  async getInfo(): Promise<LND.GetInfoResponse.AsObject> {
    const req = new LND.GetInfoRequest();
    const res = await this._grpc.request(Lightning.GetInfo, req, this._meta);
    return res.toObject();
  }

  /**
   * call the LND `ChannelBalance` RPC and return the response
   */
  async channelBalance(): Promise<LND.ChannelBalanceResponse.AsObject> {
    const req = new LND.ChannelBalanceRequest();
    const res = await this._grpc.request(Lightning.ChannelBalance, req, this._meta);
    return res.toObject();
  }

  /**
   * call the LND `WalletBalance` RPC and return the response
   */
  async walletBalance(): Promise<LND.WalletBalanceResponse.AsObject> {
    const req = new LND.WalletBalanceRequest();
    const res = await this._grpc.request(Lightning.WalletBalance, req, this._meta);
    return res.toObject();
  }

  /**
   * call the LND `ListChannels` RPC and return the response
   */
  async listChannels(): Promise<LND.ListChannelsResponse.AsObject> {
    const req = new LND.ListChannelsRequest();
    const res = await this._grpc.request(Lightning.ListChannels, req, this._meta);
    return res.toObject();
  }

  /**
   * Connect to the LND streaming endpoints
   */
  connectStreams() {
    this._grpc.subscribe(
      Lightning.SubscribeTransactions,
      new LND.GetTransactionsRequest(),
      transaction => this.emit('transaction', transaction.toObject()),
      this._meta,
    );
    this._grpc.subscribe(
      Lightning.SubscribeChannelEvents,
      new LND.ChannelEventSubscription(),
      channelEvent => this.emit('channel', channelEvent.toObject()),
      this._meta,
    );
  }
}

export default LndApi;
