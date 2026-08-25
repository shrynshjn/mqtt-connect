// Generic over the broker/profile shape so it works both for live repo data (export
// picker: Broker/ConnectionProfile, keyed by id/brokerId) and decrypted backup data
// (import picker: ExportedBroker/ExportedProfile, keyed by originalId/originalBrokerId).
export interface BrokerGroup<B, P> {
  broker: B;
  profiles: P[];
}

export function groupProfilesByBroker<B, P>(
  profiles: P[],
  brokers: B[],
  brokerIdOfProfile: (profile: P) => string,
  idOfBroker: (broker: B) => string,
): BrokerGroup<B, P>[] {
  return brokers.map(broker => ({
    broker,
    profiles: profiles.filter(
      p => brokerIdOfProfile(p) === idOfBroker(broker),
    ),
  }));
}
