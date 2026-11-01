#!/bin/sh
# The queue logic and types are shared by the mobile app and the admin dashboard.
# Edit them in shared/, then run this to copy them into both projects.
cp shared/types.ts mobile/types/index.ts
cp shared/types.ts admin/src/types/index.ts
cp shared/queueLogic.ts mobile/utils/queueLogic.ts
cp shared/queueLogic.ts admin/src/utils/queueLogic.ts
echo "Shared files synced."
