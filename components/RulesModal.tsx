import { useState } from 'react';
import PopupModal from './PopupModal';
import RulesCard from './RulesCard';

type Props = {
  open: boolean;
  onClose: () => void;
};

// The "How to play" popup: the shared popup shell (PopupModal.tsx) holding
// the rules (RulesCard), whose example tiles flip in once it has opened.
export default function RulesModal({ open, onClose }: Props) {
  // Bumped when an open animation finishes: RulesCard's example tiles flip
  // in only then.
  const [revealTrigger, setRevealTrigger] = useState(0);
  return (
    <PopupModal open={open} onClose={onClose} title="ԻՆՉՊԵ՞Ս ԽԱՂԱԼ" onOpened={() => setRevealTrigger((n) => n + 1)}>
      <RulesCard revealTrigger={revealTrigger} visible={open} />
    </PopupModal>
  );
}
