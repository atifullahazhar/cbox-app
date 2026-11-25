import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { getSocket } from '../../lib/socket';
import { Avatar } from '../ui/Avatar';

export interface ActiveCallState {
  peerUserId: string;
  peerName: string;
  peerUsername: string;
  kind: 'audio' | 'video';
  direction: 'outgoing' | 'incoming';
  incomingOffer?: RTCSessionDescriptionInit;
}

interface CallModalProps {
  call: ActiveCallState | null;
  currentUserName: string;
  currentUsername: string;
  onClose: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

export const CallModal: React.FC<CallModalProps> = ({
  call,
  currentUserName,
  currentUsername,
  onClose,
}) => {
  const [status, setStatus] = useState<'ringing' | 'connecting' | 'connected'>('ringing');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }

  function hangUp(notifyPeer = true) {
    if (notifyPeer && call) {
      getSocket()?.emit('call:hangup', { toUserId: call.peerUserId });
    }
    cleanup();
    onClose();
  }

  async function initPeerConnection(peerUserId: string, kind: 'audio' | 'video') {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current && kind === 'video') {
      localVideoRef.current.srcObject = stream;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (ev) => {
      if (remoteVideoRef.current && ev.streams[0]) {
        remoteVideoRef.current.srcObject = ev.streams[0];
      }
      setStatus('connected');
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        getSocket()?.emit('call:ice', { toUserId: peerUserId, candidate: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        hangUp(false);
      }
    };

    return pc;
  }

  useEffect(() => {
    if (!call) return;
    setError(null);
    setMuted(false);
    setCamOff(call.kind === 'audio');
    setStatus(call.direction === 'outgoing' ? 'connecting' : 'ringing');

    const socket = getSocket();
    if (!socket) return;

    if (call.direction === 'outgoing') {
      initPeerConnection(call.peerUserId, call.kind)
        .then(async (pc) => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call:offer', {
            toUserId: call.peerUserId,
            sdp: offer,
            kind: call.kind,
            callerName: currentUserName,
            callerUsername: currentUsername,
          });
        })
        .catch(() => setError('Microphone/camera permission denied or unavailable.'));
    }

    const onAnswer = async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (data.fromUserId !== call.peerUserId || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      setStatus('connected');
    };

    const onIce = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      if (data.fromUserId !== call.peerUserId || !pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {}
    };

    const onHangup = (data: { fromUserId: string }) => {
      if (data.fromUserId === call.peerUserId) hangUp(false);
    };

    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:hangup', onHangup);
    socket.on('call:reject', onHangup);

    return () => {
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:hangup', onHangup);
      socket.off('call:reject', onHangup);
      cleanup();
    };
  }, [call?.peerUserId, call?.direction]);

  async function acceptIncoming() {
    if (!call || !call.incomingOffer) return;
    setStatus('connecting');
    try {
      const pc = await initPeerConnection(call.peerUserId, call.kind);
      await pc.setRemoteDescription(new RTCSessionDescription(call.incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('call:answer', { toUserId: call.peerUserId, sdp: answer });
      setStatus('connected');
    } catch {
      setError('Could not access microphone/camera.');
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  function toggleCamera() {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
  }

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-slide">
      <div className="w-full max-w-lg rounded-3xl bg-cbox-surface border border-cbox-border p-6 shadow-2xl space-y-5 text-center">
        <div className="space-y-2">
          <div className="flex justify-center">
            <Avatar name={call.peerName} size="xl" online />
          </div>
          <h3 className="text-lg font-bold text-cbox-text">{call.peerName}</h3>
          <p className="text-xs text-cbox-muted">
            @{call.peerUsername} · {call.kind === 'video' ? 'Video Call' : 'Voice Call'} ·{' '}
            <span className="text-cbox-accent capitalize">{status}</span>
          </p>
        </div>

        {/* Media elements */}
        <div className={`relative rounded-2xl overflow-hidden bg-slate-950 ${call.kind === 'video' ? 'h-64' : 'h-0'}`}>
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          {call.kind === 'video' && (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-3 right-3 h-24 w-20 rounded-xl object-cover border-2 border-cbox-accent bg-slate-900"
            />
          )}
        </div>

        {error && <p className="text-xs text-cbox-danger">{error}</p>}

        <div className="flex items-center justify-center gap-3 pt-2">
          {call.direction === 'incoming' && status === 'ringing' ? (
            <>
              <button
                type="button"
                onClick={acceptIncoming}
                className="h-12 px-6 rounded-full bg-cbox-success text-slate-950 font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90"
              >
                <Phone className="h-4 w-4" /> Accept
              </button>
              <button
                type="button"
                onClick={() => {
                  getSocket()?.emit('call:reject', { toUserId: call.peerUserId });
                  hangUp(false);
                }}
                className="h-12 px-6 rounded-full bg-cbox-danger text-white font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90"
              >
                <PhoneOff className="h-4 w-4" /> Decline
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                aria-label="Toggle microphone"
                className={`h-12 w-12 rounded-full flex items-center justify-center border transition ${
                  muted ? 'bg-cbox-danger/20 border-cbox-danger text-cbox-danger' : 'bg-cbox-elevated border-cbox-border text-cbox-text'
                }`}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {call.kind === 'video' && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-label="Toggle camera"
                  className={`h-12 w-12 rounded-full flex items-center justify-center border transition ${
                    camOff ? 'bg-cbox-danger/20 border-cbox-danger text-cbox-danger' : 'bg-cbox-elevated border-cbox-border text-cbox-text'
                  }`}
                >
                  {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => hangUp(true)}
                aria-label="End call"
                className="h-12 px-6 rounded-full bg-cbox-danger text-white font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90"
              >
                <PhoneOff className="h-4 w-4" /> End
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
