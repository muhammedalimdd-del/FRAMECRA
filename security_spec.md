# Security Specification & Payload-First TDD (`Framecraft Studio`)

## 1. Data Invariants

1. **PII Isolation (`/users/{userId}`)**: A user's private profile (containing `email`) can only be read or written by the authenticated, email-verified user whose `uid == userId` or by the studio admin. No user can list `/users`. No user can inject a `role` or `isAdmin` field.
2. **Admin Immutability (`/admins/{adminId}`)**: Client SDKs can never create, update, or delete `/admins` records. The studio creator (`muhammedalimdd@gmail.com` with `email_verified == true`) is bootstrapped safely without relying on unverified email claims.
3. **Project Ownership & Lifecycle (`/projects/{projectId}`)**:
   - Every project must have `clientId == request.auth.uid` on creation, initial `status == 'submitted'`, `version == 0`, empty `previewUrl`/`previewNote`, and server-enforced `createdAt == request.time && updatedAt == request.time`.
   - Clients can only read/list projects where `resource.data.clientId == request.auth.uid`.
   - Clients can edit brief fields only while `status == 'submitted'`.
   - Clients can transition `status` from `'in_review'` to `'changes_requested'` or `'completed'`, and cannot set `'in_production'`, `'in_review'`, `previewUrl`, or `version`.
   - Once `status == 'completed'`, non-admins are locked out of all updates (terminal state locking).
4. **Edit Request Master Gate (`/projects/{projectId}/editRequests/{editId}`)**:
   - An edit request cannot exist without an existing parent `/projects/{projectId}` document.
   - `editRequest.clientId` must match the parent project's `clientId`, and `editRequest.projectId` must match the path `projectId`.
   - Only the project's client (or studio admin) can create, read, or list edit requests for that project.
   - New edit requests must start with `status == 'open'` and empty `resolutionNote`.
   - Once `status == 'resolved'`, non-admins cannot modify the edit request.
5. **Project Chat Integrity (`/projects/{projectId}/messages/{messageId}`)**:
   - A chat message cannot exist without an existing parent `/projects/{projectId}` document.
   - `message.senderId` must equal `request.auth.uid`, `message.projectId` must match path `projectId`, and `message.clientId` must match parent `project.clientId`.
   - Non-admin clients are strictly forbidden from setting `senderRole == 'creator'`.
   - Chat messages are append-only (updates are forbidden for everyone).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Action | Expected Result |
|---|---------------|-------------|----------------------------|-----------------|
| 1 | **Identity Spoofing on Create** | `/projects/proj_1` | Client A sets `clientId: "client_b_uid"` | `PERMISSION_DENIED` |
| 2 | **Shadow Field Injection (Ghost Field)** | `/projects/proj_1` | Valid project payload + `isApproved: true` or `isAdmin: true` | `PERMISSION_DENIED` |
| 3 | **Email Spoofing (Unverified Admin)** | `/projects/proj_1` | `email: "muhammedalimdd@gmail.com"`, `email_verified: false` | `PERMISSION_DENIED` |
| 4 | **PII Blanket Read** | `/users/victim_uid` | Authenticated Client A attempts `get()` on Client B's profile | `PERMISSION_DENIED` |
| 5 | **Unfiltered List Scraping** | `/projects` | Client A runs `getDocs(collection(db, 'projects'))` without `where('clientId', '==', uid)` | `PERMISSION_DENIED` |
| 6 | **State Shortcutting** | `/projects/proj_1` | Client creates project directly with `status: "completed"` or `version: 5` | `PERMISSION_DENIED` |
| 7 | **Terminal State Tampering** | `/projects/proj_completed` | Client attempts to update `status` or `brief` after `status == "completed"` | `PERMISSION_DENIED` |
| 8 | **Privilege Escalation via Creator Fields** | `/projects/proj_1` | Client attempts to update `previewUrl` or `version` | `PERMISSION_DENIED` |
| 9 | **Orphaned Subcollection Write** | `/projects/nonexistent_proj/editRequests/e1` | Client creates edit request under nonexistent parent project | `PERMISSION_DENIED` |
| 10 | **Creator Role Impersonation in Chat** | `/projects/proj_1/messages/m1` | Non-admin client creates message with `senderRole: "creator"` | `PERMISSION_DENIED` |
| 11 | **ID Poisoning / Resource Exhaustion** | `/projects/bad$id!!` or 5KB `title` | Invalid document ID characters or oversized string (`title.size() > 120`) | `PERMISSION_DENIED` |
| 12 | **Temporal Forgery & Immutable Field Mutation** | `/projects/proj_1` | Client sends backdated `createdAt` or attempts to alter `clientId` on update | `PERMISSION_DENIED` |
