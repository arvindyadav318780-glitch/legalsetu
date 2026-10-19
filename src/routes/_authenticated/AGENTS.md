# Signed-in routes
- Request detail page `/dashboard/requests/$id` is shared by customers, assigned professionals and staff; controls vary by role.
- Requests and appointments can only be assigned to verified professionals, enforced by guard triggers; staff route appointments from /admin/appointments.
- Admin area access is checked server-side (`getStaffAccess` server fn in the `/admin` layout); database rules and guard triggers remain the real barrier.
- Professionals must accept an assignment (`assignment_accepted_at`) before requesting documents, scheduling or changing status; reassignment by staff needs a logged reason — why: clear accountability per engagement.
