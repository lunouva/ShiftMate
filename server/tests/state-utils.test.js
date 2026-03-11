import test from "node:test";
import assert from "node:assert/strict";
import { removeUserFromOrgState } from "../src/state_utils.js";

test("removeUserFromOrgState removes user-linked records and clears assigned shifts", () => {
  const state = {
    users: [
      { id: "u1", full_name: "Target User" },
      { id: "u2", full_name: "Other User" },
    ],
    schedules: [
      {
        id: "sched1",
        shifts: [
          { id: "shift1", user_id: "u1" },
          { id: "shift2", user_id: "u2" },
        ],
      },
    ],
    time_off_requests: [
      { id: "to1", user_id: "u1" },
      { id: "to2", user_id: "u2" },
    ],
    unavailability: [
      { id: "ua1", user_id: "u1" },
      { id: "ua2", user_id: "u2" },
    ],
    tasks: [
      { id: "t1", assigned_to: "u1", created_by: "u2" },
      { id: "t2", assigned_to: "u2", created_by: "u1" },
      { id: "t3", assigned_to: "u2", created_by: "u2" },
    ],
    messages: [
      { id: "m1", from_user_id: "u1", to_user_id: "u2" },
      { id: "m2", from_user_id: "u2", to_user_id: "u1" },
      { id: "m3", from_user_id: "u2", to_user_id: "u2" },
    ],
    shift_swaps: [
      { id: "sw1", from_user_id: "u1", to_user_id: "u2" },
      { id: "sw2", from_user_id: "u2", to_user_id: "u1" },
      { id: "sw3", from_user_id: "u2", to_user_id: "u2" },
    ],
    open_shift_claims: [
      { id: "oc1", user_id: "u1" },
      { id: "oc2", user_id: "u2" },
    ],
  };

  const next = removeUserFromOrgState(state, "u1");

  assert.deepEqual(next.users, [{ id: "u2", full_name: "Other User" }]);
  assert.equal(next.schedules[0].shifts[0].user_id, null);
  assert.equal(next.schedules[0].shifts[1].user_id, "u2");
  assert.deepEqual(next.time_off_requests, [{ id: "to2", user_id: "u2" }]);
  assert.deepEqual(next.unavailability, [{ id: "ua2", user_id: "u2" }]);
  assert.deepEqual(next.tasks, [{ id: "t3", assigned_to: "u2", created_by: "u2" }]);
  assert.deepEqual(next.messages, [{ id: "m3", from_user_id: "u2", to_user_id: "u2" }]);
  assert.deepEqual(next.shift_swaps, [{ id: "sw3", from_user_id: "u2", to_user_id: "u2" }]);
  assert.deepEqual(next.open_shift_claims, [{ id: "oc2", user_id: "u2" }]);
});

test("removeUserFromOrgState returns shallow copy when user id is missing", () => {
  const state = { users: [{ id: "u1" }], schedules: [] };
  const next = removeUserFromOrgState(state, "");
  assert.notEqual(next, state);
  assert.deepEqual(next, state);
});
