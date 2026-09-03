package subservers

import (
	"context"
	"sync"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/lightninglabs/lndclient"
	"github.com/lightninglabs/taproot-assets/fn"
	"github.com/lightningnetwork/lnd/lnrpc"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"gopkg.in/macaroon-bakery.v2/bakery"

	"github.com/lightninglabs/lightning-terminal/status"
)

// fakeSubServer is a minimal SubServer implementation that records the names
// of the sub-servers it has started.
type fakeSubServer struct {
	name    string
	started []string
	mu      sync.Mutex
}

func (f *fakeSubServer) Name() string {
	return f.name
}

func (f *fakeSubServer) Remote() bool {
	return false
}

func (f *fakeSubServer) RemoteConfig() *RemoteDaemonConfig {
	return nil
}

func (f *fakeSubServer) Start(_ lnrpc.LightningClient,
	_ *lndclient.GrpcLndServices, _ bool) error {

	f.mu.Lock()
	defer f.mu.Unlock()
	f.started = append(f.started, f.name)

	return nil
}

func (f *fakeSubServer) Stop() error {
	return nil
}

func (f *fakeSubServer) RegisterGrpcService(grpc.ServiceRegistrar) {}

func (f *fakeSubServer) RegisterRestService(context.Context,
	*runtime.ServeMux, string, []grpc.DialOption) error {

	return nil
}

func (f *fakeSubServer) ServerErrChan() chan error {
	return nil
}

func (f *fakeSubServer) MacPath() string {
	return ""
}

func (f *fakeSubServer) Permissions() map[string][]bakery.Op {
	return nil
}

func (f *fakeSubServer) WhiteListedURLs() map[string]struct{} {
	return nil
}

func (f *fakeSubServer) Impl() fn.Option[any] {
	return fn.None[any]()
}

func (f *fakeSubServer) ValidateMacaroon(context.Context, []bakery.Op,
	string) error {

	return nil
}

func (f *fakeSubServer) startedNames() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]string(nil), f.started...)
}

// TestStartTapdOnlyStartsTapd asserts that StartTapd starts only the tapd
// sub-server, leaving the others for StartRemainingIntegratedServers.
func TestStartTapdOnlyStartsTapd(t *testing.T) {
	t.Parallel()

	loop := &fakeSubServer{name: LOOP}
	pool := &fakeSubServer{name: POOL}
	faraday := &fakeSubServer{name: FARADAY}
	tapd := &fakeSubServer{name: TAP}

	servers := map[string]*subServerWrapper{
		LOOP:    {SubServer: loop},
		POOL:    {SubServer: pool},
		FARADAY: {SubServer: faraday},
		TAP:     {SubServer: tapd},
	}
	mgr := &Manager{
		servers:      servers,
		statusServer: status.NewStatusManager(),
	}

	mgr.StartTapd(nil, nil, false)

	require.Equal(t, []string{TAP}, tapd.startedNames())
	require.Empty(t, loop.startedNames())
	require.Empty(t, pool.startedNames())
	require.Empty(t, faraday.startedNames())
}

// TestStartRemainingSkipsTapd asserts that StartRemainingIntegratedServers
// starts every integrated sub-server except tapd.
func TestStartRemainingSkipsTapd(t *testing.T) {
	t.Parallel()

	loop := &fakeSubServer{name: LOOP}
	pool := &fakeSubServer{name: POOL}
	faraday := &fakeSubServer{name: FARADAY}
	tapd := &fakeSubServer{name: TAP}

	servers := map[string]*subServerWrapper{
		LOOP:    {SubServer: loop},
		POOL:    {SubServer: pool},
		FARADAY: {SubServer: faraday},
		TAP:     {SubServer: tapd},
	}
	mgr := &Manager{
		servers:      servers,
		statusServer: status.NewStatusManager(),
	}

	mgr.StartRemainingIntegratedServers(nil, nil, false)

	require.Empty(t, tapd.startedNames())
	require.Equal(t, []string{LOOP}, loop.startedNames())
	require.Equal(t, []string{POOL}, pool.startedNames())
	require.Equal(t, []string{FARADAY}, faraday.startedNames())
}
