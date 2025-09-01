import React, { useState, useCallback, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
  Button,
  Card,
  Switch,
  Textarea,
  Badge,
  Alert,
  AlertDescription
} from '../ui'
import {
  Video,
  Phone,
  Copy,
  ExternalLink,
  Settings,
  Users,
  Shield,
  Clock,
  Calendar
} from 'lucide-react'
import type { ConferencingInfo, ConferencingSolution, EventAttendee, ConferencePhoneNumber } from '@flow-desk/shared'

interface ConferencingSetupProps {
  conferencing?: ConferencingInfo
  onChange: (conferencing?: ConferencingInfo) => void
  attendees?: EventAttendee[]
}

interface ConferencingProvider {
  solution: ConferencingSolution
  name: string
  icon: React.ReactNode
  description: string
  supportsPhoneDialIn: boolean
  requiresAuth: boolean
  maxParticipants?: number
}

const CONFERENCING_PROVIDERS: ConferencingProvider[] = [
  {
    solution: 'zoom',
    name: 'Zoom',
    icon: <Video className="h-4 w-4" />,
    description: 'HD video conferencing with screen sharing',
    supportsPhoneDialIn: true,
    requiresAuth: true,
    maxParticipants: 500
  },
  {
    solution: 'meet',
    name: 'Google Meet',
    icon: <Video className="h-4 w-4" />,
    description: 'Integrated with Google Calendar',
    supportsPhoneDialIn: true,
    requiresAuth: true,
    maxParticipants: 250
  },
  {
    solution: 'teams',
    name: 'Microsoft Teams',
    icon: <Video className="h-4 w-4" />,
    description: 'Enterprise-grade meetings and collaboration',
    supportsPhoneDialIn: true,
    requiresAuth: true,
    maxParticipants: 1000
  },
  {
    solution: 'webex',
    name: 'Cisco Webex',
    icon: <Video className="h-4 w-4" />,
    description: 'Secure meetings for business',
    supportsPhoneDialIn: true,
    requiresAuth: true,
    maxParticipants: 200
  },
  {
    solution: 'gotomeeting',
    name: 'GoToMeeting',
    icon: <Video className="h-4 w-4" />,
    description: 'Simple and reliable video conferencing',
    supportsPhoneDialIn: true,
    requiresAuth: true,
    maxParticipants: 150
  },
  {
    solution: 'custom',
    name: 'Custom / Other',
    icon: <Settings className="h-4 w-4" />,
    description: 'Manual configuration for any provider',
    supportsPhoneDialIn: true,
    requiresAuth: false
  }
]

export const ConferencingSetup: React.FC<ConferencingSetupProps> = ({
  conferencing,
  onChange,
  attendees = []
}) => {
  const [isEnabled, setIsEnabled] = useState(!!conferencing)
  const [selectedProvider, setSelectedProvider] = useState<ConferencingSolution>(
    conferencing?.solution || 'zoom'
  )
  const [meetingId, setMeetingId] = useState(conferencing?.meetingId || '')
  const [joinUrl, setJoinUrl] = useState(conferencing?.joinUrl || '')
  const [passcode, setPasscode] = useState(conferencing?.passcode || '')
  const [notes, setNotes] = useState(conferencing?.notes || '')
  const [phoneNumbers, setPhoneNumbers] = useState<ConferencePhoneNumber[]>(
    conferencing?.phoneNumbers || []
  )
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [waitingRoom, setWaitingRoom] = useState(true)
  const [recordMeeting, setRecordMeeting] = useState(false)

  const provider = CONFERENCING_PROVIDERS.find(p => p.solution === selectedProvider)

  // Auto-generate meeting details
  const generateMeetingDetails = useCallback(async () => {
    if (!autoGenerate || !provider?.requiresAuth) return

    try {
      // In real app, this would call the appropriate API
      const newMeetingId = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4)}`
      const newPasscode = Math.random().toString().slice(2, 8)
      
      let baseUrl = ''
      switch (selectedProvider) {
        case 'zoom':
          baseUrl = 'https://zoom.us/j/'
          break
        case 'meet':
          baseUrl = 'https://meet.google.com/'
          break
        case 'teams':
          baseUrl = 'https://teams.microsoft.com/l/meetup-join/'
          break
        case 'webex':
          baseUrl = 'https://webex.com/meet/'
          break
        case 'gotomeeting':
          baseUrl = 'https://global.gotomeeting.com/join/'
          break
      }

      setMeetingId(newMeetingId)
      setJoinUrl(`${baseUrl}${newMeetingId}${passcode ? `?pwd=${newPasscode}` : ''}`)
      setPasscode(newPasscode)

      // Add phone numbers for providers that support it
      if (provider.supportsPhoneDialIn) {
        setPhoneNumbers([
          { country: 'US', number: '+1 (646) 558-8656', pin: newMeetingId },
          { country: 'US', number: '+1 (312) 626-6799', pin: newMeetingId },
          { country: 'UK', number: '+44 20 3481 5237', pin: newMeetingId }
        ])
      }
    } catch (error) {
      console.error('Error generating meeting details:', error)
    }
  }, [autoGenerate, selectedProvider, provider, passcode])

  // Update conferencing when form changes
  useEffect(() => {
    if (!isEnabled) {
      onChange(undefined)
      return
    }

    const conferencingInfo: ConferencingInfo = {
      solution: selectedProvider,
      ...(meetingId && { meetingId }),
      ...(joinUrl && { joinUrl }),
      ...(phoneNumbers.length > 0 && { phoneNumbers }),
      ...(passcode && { passcode }),
      ...(notes && { notes })
    }

    onChange(conferencingInfo)
  }, [isEnabled, selectedProvider, meetingId, joinUrl, phoneNumbers, passcode, notes, onChange])

  // Generate meeting details when provider changes
  useEffect(() => {
    if (autoGenerate && provider?.requiresAuth) {
      generateMeetingDetails()
    }
  }, [selectedProvider, autoGenerate, generateMeetingDetails, provider])

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    // Could show a toast notification here
  }, [])

  if (!isEnabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Video Conferencing</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEnabled(true)}
          >
            <Video className="h-4 w-4 mr-1" />
            Add Meeting
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">No video conference set up</p>
      </div>
    )
  }

  const attendeeCount = attendees.filter(a => !a.isResource).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Video Conferencing</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEnabled(false)}
        >
          Remove Meeting
        </Button>
      </div>

      {/* Provider Selection */}
      <div>
        <Label htmlFor="provider">Meeting Provider</Label>
        <Select value={selectedProvider} onValueChange={(value: ConferencingSolution) => setSelectedProvider(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONFERENCING_PROVIDERS.map(provider => (
              <SelectItem key={provider.solution} value={provider.solution}>
                <div className="flex items-center gap-2">
                  {provider.icon}
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-xs text-muted-foreground">{provider.description}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Auto-generate toggle for auth providers */}
      {provider?.requiresAuth && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="autoGenerate">Auto-generate meeting details</Label>
            <p className="text-xs text-muted-foreground">
              Automatically create meeting ID and URL
            </p>
          </div>
          <Switch
            id="autoGenerate"
            checked={autoGenerate}
            onCheckedChange={setAutoGenerate}
          />
        </div>
      )}

      {/* Meeting Details */}
      <div className="space-y-4">
        {/* Meeting ID */}
        <div>
          <Label htmlFor="meetingId">Meeting ID</Label>
          <div className="flex gap-2">
            <Input
              id="meetingId"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="Enter meeting ID"
              disabled={autoGenerate && provider?.requiresAuth}
            />
            {meetingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(meetingId)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Join URL */}
        <div>
          <Label htmlFor="joinUrl">Meeting URL</Label>
          <div className="flex gap-2">
            <Input
              id="joinUrl"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="Enter meeting URL"
              disabled={autoGenerate && provider?.requiresAuth}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(joinUrl)}
              disabled={!joinUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(joinUrl, '_blank')}
              disabled={!joinUrl}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Passcode */}
        <div>
          <Label htmlFor="passcode">Meeting Passcode (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              type="password"
            />
            {passcode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(passcode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Phone Numbers */}
        {provider?.supportsPhoneDialIn && phoneNumbers.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Dial-in Numbers</Label>
            <Card className="p-3 space-y-2">
              {phoneNumbers.map((phone, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono">{phone.number}</span>
                    <Badge variant="outline" className="text-xs">
                      {phone.country}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`${phone.number},,${phone.pin || meetingId}#`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {phoneNumbers[0]?.pin && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Meeting ID: {phoneNumbers[0].pin}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Meeting Notes */}
        <div>
          <Label htmlFor="notes">Meeting Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add meeting agenda, preparation notes, or instructions..."
            rows={3}
          />
        </div>
      </div>

      {/* Meeting Settings */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Meeting Settings</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="waitingRoom" className="text-sm">Enable waiting room</Label>
              <p className="text-xs text-muted-foreground">
                Host must admit participants
              </p>
            </div>
            <Switch
              id="waitingRoom"
              checked={waitingRoom}
              onCheckedChange={setWaitingRoom}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="recordMeeting" className="text-sm">Record meeting</Label>
              <p className="text-xs text-muted-foreground">
                Automatically record the session
              </p>
            </div>
            <Switch
              id="recordMeeting"
              checked={recordMeeting}
              onCheckedChange={setRecordMeeting}
            />
          </div>
        </div>
      </div>

      {/* Meeting Info Summary */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {provider?.icon}
            <span className="font-medium text-blue-800">{provider?.name} Meeting</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}</span>
            </div>
            
            {provider?.maxParticipants && (
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Max {provider.maxParticipants} participants</span>
              </div>
            )}
          </div>
          
          {attendeeCount > (provider?.maxParticipants || 0) && (
            <Alert className="mt-2">
              <AlertDescription className="text-xs">
                Warning: You have more attendees than the maximum supported by {provider?.name}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(`
Meeting: ${provider?.name}
Join URL: ${joinUrl}
Meeting ID: ${meetingId}
${passcode ? `Passcode: ${passcode}` : ''}
${phoneNumbers.length > 0 ? `\nDial-in: ${phoneNumbers[0].number}` : ''}
          `.trim())}
          disabled={!joinUrl}
        >
          <Copy className="h-4 w-4 mr-1" />
          Copy All Details
        </Button>
        
        {provider?.requiresAuth && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateMeetingDetails}
          >
            <Video className="h-4 w-4 mr-1" />
            Generate New Meeting
          </Button>
        )}
      </div>
    </div>
  )
}