import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'
import { LoginLogs } from '@/components/admin/login-logs'

export default function LoginLogsPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Login Logs</h1>
        </div>
        <LoginLogs />
      </div>
    </AdminDashboardLayout>
  )
}
