const asArray = (value) => (Array.isArray(value) ? value : []);

const isSameUser = (value, userId) => String(value || "") === userId;

export const removeUserFromOrgState = (state, userId) => {
  const targetUserId = String(userId || "").trim();
  const source = state && typeof state === "object" ? state : {};
  if (!targetUserId) return { ...source };

  const schedules = asArray(source.schedules).map((schedule) => ({
    ...schedule,
    shifts: asArray(schedule?.shifts).map((shift) => (
      isSameUser(shift?.user_id, targetUserId)
        ? { ...shift, user_id: null }
        : shift
    )),
  }));

  return {
    ...source,
    users: asArray(source.users).filter((user) => !isSameUser(user?.id, targetUserId)),
    schedules,
    time_off_requests: asArray(source.time_off_requests).filter((request) => !isSameUser(request?.user_id, targetUserId)),
    unavailability: asArray(source.unavailability).filter((entry) => !isSameUser(entry?.user_id, targetUserId)),
    tasks: asArray(source.tasks).filter(
      (task) => !isSameUser(task?.assigned_to, targetUserId) && !isSameUser(task?.created_by, targetUserId)
    ),
    messages: asArray(source.messages).filter(
      (message) => !isSameUser(message?.from_user_id, targetUserId) && !isSameUser(message?.to_user_id, targetUserId)
    ),
    shift_swaps: asArray(source.shift_swaps).filter(
      (swap) => !isSameUser(swap?.from_user_id, targetUserId) && !isSameUser(swap?.to_user_id, targetUserId)
    ),
    open_shift_claims: asArray(source.open_shift_claims).filter((claim) => !isSameUser(claim?.user_id, targetUserId)),
  };
};
