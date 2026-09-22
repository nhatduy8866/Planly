import { Modal, type ModalProps } from 'react-native';

import { MOTION } from '../../theme/motion';
import { useReducedMotion } from './MotionProvider';

type MotionModalProps = Omit<ModalProps, 'animationType'>;

export function MotionModal(props: MotionModalProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      {...props}
      animationType={reducedMotion ? 'none' : MOTION.modalAnimation}
    />
  );
}
