// Regenerates server/db.json (the json-server database) from the same fixture the in-browser
// mock API uses, so both backends start with identical boards and tasks.
// Run: node server/generate-db.mjs
import { writeFileSync } from 'node:fs';
import { BOARD_TASKS } from '../src/app/features/board/board-data.ts';

const boards = Object.keys(BOARD_TASKS).map((id) => ({ id }));
const tasks = Object.entries(BOARD_TASKS).flatMap(([boardId, boardTasks]) =>
  boardTasks.map((task) => ({ ...task, boardId })),
);

writeFileSync(new URL('./db.json', import.meta.url), JSON.stringify({ boards, tasks }, null, 2) + '\n');
console.log(`db.json written: ${boards.length} boards, ${tasks.length} tasks`);
