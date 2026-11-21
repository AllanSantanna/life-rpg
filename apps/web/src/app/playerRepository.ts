import { createTransactionalStateStorage } from '../shared/storage/transactionalStateStorage';
import {
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';

export const browserPlayerStorage = createTransactionalStateStorage({
  key: PLAYER_STORAGE_KEY,
  version: PLAYER_STORAGE_VERSION,
  validate: isPlayerState,
  migrate: migratePlayerState,
});
