import { Button } from "./ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx"
import { Badge } from "./ui/badge.tsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.tsx"
import { Input } from "./ui/input.tsx"
import { Label } from "./ui/label.tsx"
import { Textarea } from "./ui/textarea.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx"
import { ArrowLeft, BarChart3, MapPin, Users, Clock, CheckCircle, AlertTriangle, Filter, User, Pencil, Map } from "lucide-react"
import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"
import ComplaintMap from "./ComplaintMap"
import { useState, useEffect } from "react"
import { supabase } from "../integrations/supabase/client.ts"
import { useToast } from "../hooks/use-toast.ts"

interface AdminPortalProps {
  onBack: () => void
}

const AdminPortal = ({ onBack }: AdminPortalProps) => {
  const [complaints, setComplaints] = useState<any[]>([])
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ issue?: string; city?: string; from?: string; to?: string }>({})
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [mapComplaints, setMapComplaints] = useState<any[]>([])
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null)
  const [authorityName, setAuthorityName] = useState("")
  const [workerName, setWorkerName] = useState("")
  const [workerContact, setWorkerContact] = useState("")
  const [statusNote, setStatusNote] = useState("")
  const [newStatus, setNewStatus] = useState("")
  const { toast } = useToast()
  const [latestAssignments, setLatestAssignments] = useState<Record<string, { worker?: string | null; contact?: string | null }>>({})

  useEffect(() => {
    fetchComplaints()
    fetchStats()
    
    const channel = supabase
      .channel('admin-complaints')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        fetchComplaints()
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error
      const list = data || []
      setComplaints(list)
      // Fetch latest worker assignment per complaint
      const ids = list.map((c: any) => c.id)
      if (ids.length > 0) {
        const { data: updates, error: updatesErr } = await supabase
          .from('complaint_status_updates')
          .select('complaint_id, assigned_to, assigned_contact, created_at')
          .in('complaint_id', ids)
          .order('created_at', { ascending: false })

        if (!updatesErr && updates) {
          const map: Record<string, { worker?: string | null; contact?: string | null }> = {}
          for (const u of updates) {
            if (!map[u.complaint_id] && (u.assigned_to || u.assigned_contact)) {
              map[u.complaint_id] = { worker: u.assigned_to, contact: u.assigned_contact }
            }
          }
          setLatestAssignments(map)
        }
        } else {
          setLatestAssignments({})
        }
        
        // Also fetch complaints with GPS coordinates for map
        const { data: mapData, error: mapError } = await supabase
          .from('complaints')
          .select('id, complaint_code, issue_type, city, state, gps_latitude, gps_longitude, status, created_at')
          .not('gps_latitude', 'is', null)
          .not('gps_longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100)

        if (!mapError) {
          setMapComplaints(mapData || [])
        }
      } catch (error) {
        console.error('Error fetching complaints:', error)
        toast({ title: "Error fetching complaints", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('status')

      if (error) throw error
      
      const stats = data?.reduce((acc, complaint) => {
        const status = complaint.status?.toLowerCase()
        if (status === 'registered') acc.pending++
        else if (status === 'assigned' || status === 'in-progress') acc.inProgress++
        else if (status === 'resolved') acc.resolved++
        acc.total++
        return acc
      }, { pending: 0, inProgress: 0, resolved: 0, total: 0 }) || { pending: 0, inProgress: 0, resolved: 0, total: 0 }

      setStats(stats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleAssignWorker = async () => {
    if (!selectedComplaint || !workerName || !workerContact || !newStatus) {
      toast({ title: "Please fill all fields", variant: "destructive" })
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('complaints')
        .update({ 
          status: newStatus as any,
          assigned_to: authorityName 
        })
        .eq('id', selectedComplaint.id)

      if (updateError) throw updateError

      const { error: statusError } = await supabase
        .from('complaint_status_updates')
        .insert({
          complaint_id: selectedComplaint.id,
          status: newStatus as any,
          assigned_to: workerName,
          assigned_contact: workerContact,
          note: statusNote
        })

      if (statusError) throw statusError

      toast({ 
        title: "Worker Assigned Successfully",
        description: `${workerName} has been assigned to complaint ${selectedComplaint.complaint_code}`
      })
      
      setAssignDialogOpen(false)
      // Reset form state
      setWorkerName("")
      setWorkerContact("")
      setStatusNote("")
      setNewStatus("")
      setSelectedComplaint(null)
      setAuthorityName("")

    } catch (error) {
      console.error('Error assigning worker:', error)
      toast({ title: "Error assigning worker", variant: "destructive" })
    }
  }

  const openAssignDialog = (complaint: any) => {
    setSelectedComplaint(complaint)
    setNewStatus(complaint.status || "")
    setAuthorityName(complaint.assigned_to || "")
    setWorkerName(latestAssignments[complaint.id]?.worker || "")
    setAssignDialogOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'registered': return 'bg-civic-saffron/20 text-civic-saffron'
      case 'assigned': return 'bg-civic-blue/20 text-civic-blue'
      case 'in-progress': return 'bg-yellow-100 text-yellow-700'
      case 'resolved': return 'bg-civic-green/20 text-civic-green'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  // Derived datasets
  const filteredComplaints = complaints.filter((c) => {
    const matchIssue = filters.issue ? (c.issue_type || '').toLowerCase().includes(filters.issue.toLowerCase()) : true
    const matchCity = filters.city ? (c.city || '').toLowerCase().includes(filters.city.toLowerCase()) : true
    const created = c.created_at ? new Date(c.created_at) : null
    const fromOk = filters.from && created ? created >= new Date(filters.from) : true
    const toOk = filters.to && created ? created <= new Date(filters.to) : true
    return matchIssue && matchCity && fromOk && toOk
  })

  const byIssueType = Object.values(
    filteredComplaints.reduce((acc: any, c: any) => {
      const key = (c.issue_type || 'Unknown')
      acc[key] = acc[key] || { name: key, count: 0 }
      acc[key].count += 1
      return acc
    }, {})
  ).sort((a: any, b: any) => b.count - a.count)

  const byCity = Object.values(
    filteredComplaints.reduce((acc: any, c: any) => {
      const key = (c.city || 'Unknown')
      acc[key] = acc[key] || { name: key, count: 0 }
      acc[key].count += 1
      return acc
    }, {})
  ).sort((a: any, b: any) => b.count - a.count)

  const topCities = byCity.slice(0, 10)

  // Comparison dataset: for top 5 cities, counts per top 5 issue types
  const topIssueNames = byIssueType.slice(0, 5).map((d: any) => d.name)
  const topCityNames = topCities.slice(0, 5).map((d: any) => d.name)
  const comparison = topCityNames.map((city: string) => {
    const row: any = { city }
    topIssueNames.forEach((issue) => {
      row[issue] = filteredComplaints.filter((c) => (c.city || 'Unknown') === city && (c.issue_type || 'Unknown') === issue).length
    })
    return row
  })

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-civic-blue/10 to-background">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-civic-blue/20">
          <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">Municipal Corporation Portal</p>
              </div>
            </div>
            <Badge className="bg-civic-blue text-white">
              Government Official
            </Badge>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-civic-saffron/20">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-civic-saffron mx-auto mb-2" />
                <p className="text-2xl font-bold text-civic-saffron">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-200">
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>

            <Card className="border-civic-green/20">
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-8 w-8 text-civic-green mx-auto mb-2" />
                <p className="text-2xl font-bold text-civic-green">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>

            <Card className="border-civic-blue/20">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 text-civic-blue mx-auto mb-2" />
                <p className="text-2xl font-bold text-civic-blue">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Complaints</p>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Dashboard */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card className="border-civic-green/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-civic-green" />
                  Complaints per Issue Type
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={byIssueType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#16a34a" />
                  </RBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-civic-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-civic-blue" />
                  Complaints per Area/District
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={topCities} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" />
                  </RBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-civic-saffron/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-civic-saffron" />
                  Complaint Trend Comparison (Issue vs Area)
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={comparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="city" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {topIssueNames.map((issue, idx) => (
                      <Bar key={issue} dataKey={issue} stackId="a" fill={["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"][idx % 5]} />
                    ))}
                  </RBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Complaint Management - Filters */}
          <Card className="border-civic-blue/20 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-civic-blue" />
                Complaint Management Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="issue-filter">Issue Type</Label>
                  <Input id="issue-filter" placeholder="e.g., water, road, garbage" value={filters.issue || ''} onChange={(e) => setFilters((f) => ({ ...f, issue: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="city-filter">Area / District</Label>
                  <Input id="city-filter" placeholder="e.g., Delhi" value={filters.city || ''} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="from-date">From</Label>
                  <Input id="from-date" type="date" value={filters.from || ''} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="to-date">To</Label>
                  <Input id="to-date" type="date" value={filters.to || ''} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-civic-saffron/20"
              onClick={() => setShowMap(true)}
            >
              <CardContent className="p-6 text-center">
                <MapPin className="h-12 w-12 text-civic-saffron mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Live Complaint Map</h3>
                <p className="text-sm text-muted-foreground">View complaints on GIS map</p>
                <Badge variant="outline" className="mt-2">
                  {mapComplaints.length} locations
                </Badge>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-civic-green/20">
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-12 w-12 text-civic-green mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
                <p className="text-sm text-muted-foreground">Performance metrics</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-civic-blue/20">
              <CardContent className="p-6 text-center">
                <Filter className="h-12 w-12 text-civic-blue mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Advanced Filters</h3>
                <p className="text-sm text-muted-foreground">Filter by type, location</p>
              </CardContent>
            </Card>
          </div>

          {/* Complaint Management View (Filtered List) */}
          <Card className="border-civic-saffron/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Complaints</span>
                <Button variant="outline" size="sm" className="border-civic-saffron text-civic-saffron">
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">Loading complaints...</div>
                ) : filteredComplaints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No complaints found</div>
                ) : (
                  filteredComplaints.map((complaint) => (
                    <div key={complaint.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{complaint.issue_type || 'General Issue'}</h4>
                          <Badge variant="outline" className="text-xs">{complaint.complaint_code}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {complaint.city}, {complaint.state}
                          </span>
                          <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getStatusColor(complaint.status)}>
                            {complaint.status}
                          </Badge>
                          {complaint.assigned_to && (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Authority: {complaint.assigned_to}
                              </Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAssignDialog(complaint)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {latestAssignments[complaint.id]?.worker && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Worker: {latestAssignments[complaint.id]?.worker}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {complaint.description}
                        </p>
                        {complaint.voice_note_url && (
                          <div className="mt-2">
                            <audio controls className="w-full">
                              <source src={complaint.voice_note_url} />
                            </audio>
                          </div>
                        )}
                        {complaint.media_url && (
                          <div className="mt-2">
                            <img src={complaint.media_url} alt="evidence" className="max-h-40 rounded" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openAssignDialog(complaint)}
                          disabled={complaint.status === 'Resolved'}
                        >
                          Assign Worker
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Worker to Complaint</DialogTitle>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">Update Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In-Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="worker-name">Worker Name</Label>
                <Input 
                  id="worker-name"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="Enter worker name"
                />
              </div>
              
              <div>
                <Label htmlFor="worker-contact">Worker Contact Number</Label>
                <Input 
                  id="worker-contact"
                  value={workerContact}
                  onChange={(e) => setWorkerContact(e.target.value)}
                  placeholder="Enter contact number"
                  type="tel"
                />
              </div>
              
              <div>
                <Label htmlFor="status-note">Note (Optional)</Label>
                <Textarea 
                  id="status-note"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Add any additional notes"
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleAssignWorker}
                className="w-full bg-civic-green hover:bg-civic-green/90"
              >
                Assign Worker
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Map Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="max-w-4xl h-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5 text-civic-saffron" />
              Live Complaint Map
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1">
            <div className="h-full bg-muted/20 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <div className="space-y-2 overflow-y-auto">
                  <h4 className="font-semibold">Complaints by Location ({mapComplaints.length})</h4>
                  {mapComplaints.map((complaint) => (
                    <div key={complaint.id} className="p-3 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-sm">{complaint.issue_type}</h5>
                        <Badge className={getStatusColor(complaint.status)}>
                          {complaint.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {complaint.complaint_code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {complaint.city}, {complaint.state}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        📍 {complaint.gps_latitude?.toFixed(4)}, {complaint.gps_longitude?.toFixed(4)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="h-full">
                  <ComplaintMap complaints={mapComplaints} />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AdminPortal

