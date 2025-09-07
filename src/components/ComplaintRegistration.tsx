import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Camera, MapPin, Send, CheckCircle, LoaderCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface ComplaintRegistrationProps {
  onBack: () => void
}

const ComplaintRegistration = ({ onBack }: ComplaintRegistrationProps) => {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [complaintId, setComplaintId] = useState<string>('')
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);


  const [formData, setFormData] = useState({
    state: '',
    city: '',
    issueType: '',
    description: '',
    media: null as File | null
  })

  const issueTypes = [
    { value: 'streetlight', label: '🔦 Street Light Issues', category: 'Infrastructure' },
    { value: 'pothole', label: '🕳️ Pothole/Road Damage', category: 'Roads' },
    { value: 'garbage', label: '🗑️ Garbage Collection', category: 'Sanitation' },
    { value: 'drainage', label: '🌊 Drainage Problems', category: 'Water' },
    { value: 'water', label: '💧 Water Supply Issues', category: 'Water' },
    { value: 'electricity', label: '⚡ Power Outage', category: 'Utilities' },
    { value: 'noise', label: '🔊 Noise Pollution', category: 'Environment' },
    { value: 'others', label: '📝 Other Issues', category: 'General' }
  ]

  const states = [
    'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 
    'Rajasthan', 'West Bengal', 'Delhi', 'Others'
  ]


  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.issueType) {
        toast({
            title: "Please select an issue type first",
            description: "The AI needs to know what kind of issue to look for.",
            variant: "destructive"
        });
        e.target.value = ''; // Reset file input
        return;
    }

    setFormData(prev => ({ ...prev, media: file, description: '' })); // Clear previous description
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];

        try {
            const { data, error } = await supabase.functions.invoke('analyze-complaint-image', {
                body: { imageData: base64data, issueType: formData.issueType },
            });

            if (error) throw error;
            
            if (data.is_relevant) {
                setFormData(prev => ({ ...prev, description: data.description }));
                toast({
                    title: "Image Analyzed Successfully",
                    description: "An AI-generated description has been added.",
                });
            } else {
                setFormData(prev => ({ ...prev, media: null })); // Clear invalid media
                e.target.value = ''; // Reset file input
                toast({
                    title: "Irrelevant Image Detected",
                    description: data.reason || "Please upload an image related to the selected issue.",
                    variant: "destructive"
                });
            }
        } catch (err) {
            console.error('Error analyzing image:', err);
            toast({
                title: "AI Analysis Failed",
                description: "Could not analyze the image. Please write a description manually.",
                variant: "destructive"
            });
        } finally {
            setIsAnalyzing(false);
        }
    };
  };

  const handleSubmit = async () => {
    if (!formData.state || !formData.city || !formData.issueType || !formData.description) {
        toast({
          title: "Missing Information",
          description: "Please fill all required fields",
          variant: "destructive"
        })
        return
      }
      setIsSubmitting(true);
      try {
        let mediaUrl = null
  
        if (formData.media) {
          const fileExt = formData.media.name.split('.').pop()
          const fileName = `${Date.now()}.${fileExt}`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('complaints')
            .upload(fileName, formData.media)
  
          if (uploadError) throw uploadError
          
          const { data: { publicUrl } } = supabase.storage
            .from('complaints')
            .getPublicUrl(fileName)
          
          mediaUrl = publicUrl
        }
  
        const { data, error } = await supabase
          .from('complaints')
          .insert({
            state: formData.state,
            city: formData.city, 
            issue_type: formData.issueType,
            description: formData.description,
            media_url: mediaUrl
          } as any)
          .select('complaint_code')
          .single()
  
        if (error) throw error
  
        setComplaintId(data.complaint_code)
        setStep('success')
        
        toast({
          title: "Report Submitted Successfully! 🎉",
          description: `Complaint ID: ${data.complaint_code}`,
          variant: "default"
        })
      } catch (error) {
        console.error('Error submitting complaint:', error)
        toast({
          title: "Submission Failed",
          description: "Please try again later",
          variant: "destructive"
        })
      } finally {
          setIsSubmitting(false);
      }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-civic-green-light to-background p-6">
        <div className="max-w-md mx-auto pt-8">
          <Card className="border-civic-green border-2 shadow-success">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <CheckCircle className="h-20 w-20 text-civic-green mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-civic-green mb-2">
                  Report Submitted Successfully! 🎉
                </h2>
              </div>

              <div className="bg-civic-green/10 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-2">Your Complaint ID</p>
                <p className="text-2xl font-bold text-civic-green font-mono">{complaintId}</p>
              </div>

              <div className="bg-gradient-to-r from-civic-saffron/10 to-civic-green/10 rounded-lg p-4 mb-6">
                <p className="font-semibold text-civic-saffron text-lg mb-2">
                  🙏 You are a Responsible Citizen of India
                </p>
                <p className="font-bold text-civic-green">
                  Truly a Nagar Rakshak!
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  variant="default"
                  size="lg" 
                  className="w-full"
                  onClick={() => onBack()}
                >
                  Track This Complaint
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full"
                  onClick={() => {
                    setStep('form')
                    setFormData({
                      state: '',
                      city: '',
                      issueType: '',
                      description: '',
                      media: null
                    })
                  }}
                >
                  Register New Complaint
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-civic-orange-light to-background">
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-civic-saffron/20">
        <div className="flex items-center p-4 max-w-md mx-auto">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Register New Complaint</h1>
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto">
        <Card className="shadow-lg border-civic-saffron/20">
          <CardHeader className="bg-gradient-to-r from-civic-saffron/5 to-civic-green/5">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-civic-saffron" />
              Issue Details
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
               <div>
                <Label htmlFor="issueType">Issue Type *</Label>
                <Select value={formData.issueType} onValueChange={(value) => setFormData(prev => ({...prev, issueType: value}))}>
                  <SelectTrigger id="issueType">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueTypes.map(issue => (
                      <SelectItem key={issue.value} value={issue.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{issue.label}</span>
                          <Badge variant="secondary" className="ml-2">{issue.category}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="state">State / UT *</Label>
                <Select value={formData.state} onValueChange={(value) => setFormData(prev => ({...prev, state: value}))}>
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="city">City / District *</Label>
                <Input
                  id="city" 
                  placeholder="Enter city or district"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({...prev, city: e.target.value}))}
                />
              </div>
            </div>

            <div>
              <Label>Upload Photo (Optional)</Label>
              <div className="border-2 border-dashed border-civic-saffron/30 rounded-lg p-4 text-center hover:border-civic-saffron/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                  id="media-upload"
                  disabled={isAnalyzing}
                />
                <label htmlFor="media-upload" className={cn("cursor-pointer", isAnalyzing && "cursor-not-allowed")}>
                  {isAnalyzing ? (
                      <LoaderCircle className="h-8 w-8 text-civic-saffron mx-auto mb-2 animate-spin" />
                  ) : (
                      <Camera className="h-8 w-8 text-civic-saffron mx-auto mb-2" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isAnalyzing ? "Analyzing..." : formData.media ? formData.media.name : 'Tap to add photo'}
                  </p>
                  <p className="text-xs text-civic-saffron mt-1">AI will generate a description for you</p>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea
                id="description"
                placeholder={isAnalyzing ? "AI is analyzing the image..." : "Describe the issue or let AI do it for you."}
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                disabled={isAnalyzing}
              />
            </div>

            <Button 
              size="xl" 
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting || isAnalyzing}
            >
              {isSubmitting ? <LoaderCircle className="animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ComplaintRegistration;

