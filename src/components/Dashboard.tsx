import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Search, Phone, BarChart3, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "../integrations/supabase/client"
import NotificationSystem from "./NotificationSystem"

interface DashboardProps {
  onBack: () => void
  onNavigate: (screen: string) => void
}

const Dashboard = ({ onBack, onNavigate }: DashboardProps) => {
  const [stats, setStats] = useState({ resolved: 0, inProgress: 0, total: 0 })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch complaint stats
      const { data: complaints, error: complaintsError } = await supabase
        .from('complaints')
        .select('status, created_at, complaint_code, issue_type, updated_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (complaintsError) {
        console.error('Complaints error:', complaintsError)
        throw complaintsError
      }

      console.log('Fetched complaints:', complaints)

      // If no complaints, show some mock data for demo
      if (!complaints || complaints.length === 0) {
        console.log('No complaints found, using mock data')
        setStats({ resolved: 5, inProgress: 3, total: 8 })
        setRecentActivity([
          {
            id: 'NGR123456',
            type: 'Street Light Issues',
            status: 'Resolved',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'NGR123457',
            type: 'Pothole/Road Damage',
            status: 'In-Progress',
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ])
        return
      }

      // Calculate stats
      const stats = complaints?.reduce((acc, complaint) => {
        const status = complaint.status?.toLowerCase()
        if (status === 'resolved') acc.resolved++
        else if (status === 'assigned' || status === 'in-progress') acc.inProgress++
        acc.total++
        return acc
      }, { resolved: 0, inProgress: 0, total: 0 }) || { resolved: 0, inProgress: 0, total: 0 }

      console.log('Calculated stats:', stats)
      setStats(stats)

      // Get recent activity (last 5 complaints)
      const recent = complaints?.slice(0, 5).map(complaint => ({
        id: complaint.complaint_code,
        type: complaint.issue_type,
        status: complaint.status,
        date: complaint.updated_at || complaint.created_at
      })) || []

      console.log('Recent activity:', recent)
      setRecentActivity(recent)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'border-civic-green text-civic-green'
      case 'assigned': 
      case 'in-progress': return 'border-civic-saffron text-civic-saffron'
      default: return 'border-muted text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-civic-orange-light">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-civic-saffron/20">
        <div className="flex items-center justify-between p-4 max-w-md mx-auto">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Citizen Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome, Nagar Rakshak!</p>
            </div>
          </div>
          <NotificationSystem />
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-civic-saffron/20">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-civic-green mx-auto mb-2" />
              <p className="text-2xl font-bold text-civic-green">
                {loading ? "..." : stats.resolved}
              </p>
              <p className="text-xs text-muted-foreground">Issues Resolved</p>
            </CardContent>
          </Card>
          
          <Card className="border-civic-green/20">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-civic-saffron mx-auto mb-2" />
              <p className="text-2xl font-bold text-civic-saffron">
                {loading ? "..." : stats.inProgress}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="space-y-4">
          <Card 
            className="border-2 border-civic-saffron/20 hover:border-civic-saffron/40 transition-colors cursor-pointer transform hover:scale-[1.02] duration-200"
            onClick={() => onNavigate('complaint')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-r from-civic-saffron to-civic-green p-4 rounded-full shadow-civic">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Register New Complaint</h3>
                  <p className="text-sm text-muted-foreground">Report civic issues in your area</p>
                  <Badge variant="outline" className="mt-2 border-civic-saffron text-civic-saffron">
                    Quick Submit
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-civic-green/20 hover:border-civic-green/40 transition-colors cursor-pointer transform hover:scale-[1.02] duration-200"
            onClick={() => onNavigate('tracking')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-civic-green p-4 rounded-full shadow-success">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Track Complaint Status</h3>
                  <p className="text-sm text-muted-foreground">Monitor your reports progress</p>
                  <Badge variant="outline" className="mt-2 border-civic-green text-civic-green">
                    Real-time Updates
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-civic-blue/20 hover:border-civic-blue/40 transition-colors cursor-pointer transform hover:scale-[1.02] duration-200"
            onClick={() => onNavigate('helpline')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-civic-blue p-4 rounded-full">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Emergency Helplines</h3>
                  <p className="text-sm text-muted-foreground">Important contact numbers</p>
                  <Badge variant="outline" className="mt-2 border-civic-blue text-civic-blue">
                    24/7 Available
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-civic-saffron/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-civic-saffron" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading recent activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No recent activity</div>
            ) : (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/5 rounded-lg">
                  <div>
                    <p className="font-medium">{activity.type || 'General Issue'}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.id} • {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(activity.status)}>
                    {activity.status || 'Unknown'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Appreciation Section */}
        <Card className="bg-gradient-to-r from-civic-saffron/10 to-civic-green/10 border-civic-saffron/30">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-civic-saffron mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Community Impact</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Your reports have helped improve 5 civic issues this month!
            </p>
            <Badge className="bg-gradient-to-r from-civic-saffron to-civic-green text-white">
              🏆 Active Citizen Badge
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard