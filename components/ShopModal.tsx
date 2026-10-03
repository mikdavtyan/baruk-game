import PopupModal from './PopupModal';

type Props = {
  open: boolean;
  onClose: () => void;
};

// The shop window, opened from the header's coin pill: the shared popup
// shell (PopupModal.tsx). Its body is empty for now.
export default function ShopModal({ open, onClose }: Props) {
  return <PopupModal open={open} onClose={onClose} title="ԽԱՆՈՒԹ" />;
}
