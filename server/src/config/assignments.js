export const BRANCHES = ['CSE', 'IT', 'IoT', 'AI', 'DS', 'ME', 'EE', 'CE', 'ECE'];
export const SECTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const GROUPS = ['1', '2'];

export function assignmentKey({ branch, section, group }) {
  return `${branch}:${section}:${group}`;
}
