-- A task made from a Watch item (docs/WATCH_TASKS_PLAN.md). No foreign key: Watch's tables live in another module and a source's
-- removal cascades its items away, so the id may dangle and the task must keep working. `watch_url` is the item's address copied at
-- link time, so the task still shows the call's link after the item is gone. NULL: not made from a Watch item.
ALTER TABLE tasks ADD COLUMN watch_item_id INTEGER;
ALTER TABLE tasks ADD COLUMN watch_url TEXT;
