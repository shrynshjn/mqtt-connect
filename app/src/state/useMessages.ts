import { useEffect, useState } from 'react';
import * as manager from '../mqtt/connectionManager';
import type { ProfileId } from '../types/profile';
import type { MqttMessage } from '../types/message';

/**
 * Deliberately a plain hook, not a slice of connectionsStore — a message array can run
 * to thousands of entries, and putting it in the same store the Hub's cards read from
 * would re-render every card on every single inbound message. Only components actually
 * showing a feed (Feed tab, Traffic) pay for this.
 */
export function useMessages(profileId: ProfileId): MqttMessage[] {
  const [messages, setMessages] = useState<MqttMessage[]>(() => manager.getMessages(profileId));

  useEffect(() => {
    setMessages(manager.getMessages(profileId));
    return manager.onMessages(profileId, setMessages);
  }, [profileId]);

  return messages;
}
