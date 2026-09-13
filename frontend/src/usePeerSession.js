import { useCallback, useMemo } from 'react';
import { canDispatch } from './api';
import {
  openDm,
  openPeerSheet,
  openPeoplePalette,
  startRemoteCamera,
  startVideoCall,
  startVoiceCall,
} from './peerActions';

/**
 * API de acciones peer para cualquier pantalla del panel.
 */
export function usePeerSession(session) {
  const allowRemoteCamera = Boolean(session?.user && canDispatch(session.user));

  const api = useMemo(
    () => ({
      openDm,
      openPeerSheet,
      openPeoplePalette,
      startVoice: startVoiceCall,
      startVideo: startVideoCall,
      startRemoteCamera: allowRemoteCamera ? startRemoteCamera : null,
      allowRemoteCamera,
    }),
    [allowRemoteCamera]
  );

  const contact = useCallback(
    (peer) => {
      openPeerSheet(peer);
    },
    []
  );

  return { ...api, contact, session };
}
