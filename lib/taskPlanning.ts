/**
 * A guest request becomes an operational task only after the team assigns its
 * internal due date. Keep this predicate centralized so boards, search and
 * reports cannot accidentally disagree about the planning queue boundary.
 */
export function plannedTaskCondition(alias = "t"): string {
  return `(${alias}.origin != 'guest' OR ${alias}.due_date IS NOT NULL)`;
}

/**
 * Team-created content remains visible even without tasks. Content generated
 * solely for an unplanned guest request stays hidden until that request is
 * scheduled (or another operational task is attached to the content).
 */
export function visibleContentCondition(alias = "ci"): string {
  return `(
    NOT EXISTS (
      SELECT 1 FROM tasks pending_guest
       WHERE pending_guest.content_item_id = ${alias}.id
         AND pending_guest.origin = 'guest'
         AND pending_guest.due_date IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM tasks operational_task
       WHERE operational_task.content_item_id = ${alias}.id
         AND ${plannedTaskCondition("operational_task")}
    )
  )`;
}
