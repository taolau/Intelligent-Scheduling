// 同任务连任判定：把 staff 加入 project 的 weekStart 自然周后，含该周的极大连续占有段长。
// 段轴 = projectWeeks（该任务"有发生周"升序）：空窗周不在轴故不中断，他人接手的周在轴但非 held 故中断。
export function tenureRunAfterAdd(projectId, staffId, weekStart, ctx) {
  const occ = ctx?.tenure?.get(`${staffId}|${projectId}`);
  const ws = ctx?.projectWeeks?.get(projectId) ?? [];
  const held = new Set();
  if (occ) for (const [w, c] of occ) if (c > 0) held.add(w);
  held.add(weekStart);
  const axis = [...new Set([...ws, weekStart])].sort();
  const i = axis.indexOf(weekStart);
  if (i === -1) return 1; // 理论不可达（weekStart 已并入 axis）
  let left = 0;
  for (let k = i - 1; k >= 0 && held.has(axis[k]); k--) left++;
  let right = 0;
  for (let k = i + 1; k < axis.length && held.has(axis[k]); k++) right++;
  return left + 1 + right;
}
