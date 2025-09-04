import React, { useState, useCallback } from 'react'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Avatar,
  AvatarFallback,
  Switch,
  Label,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui'
import { 
  Plus, 
  X, 
  Users, 
  Mail, 
  UserCheck, 
  UserX, 
  Clock, 
  Calendar,
  Search,
  Building,
  MapPin
} from 'lucide-react'
import type { EventAttendee, AttendeeResponseStatus } from '@flow-desk/shared'

interface AttendeeManagerProps {
  attendees: EventAttendee[]
  onChange: (attendees: EventAttendee[]) => void
  canEditAttendees?: boolean
  organizerEmail?: string
}

interface ContactSuggestion {
  email: string
  name: string
  title?: string
  company?: string
  isFrequent?: boolean
}

export const AttendeeManager: React.FC<AttendeeManagerProps> = ({
  attendees,
  onChange,
  canEditAttendees = true,
  organizerEmail
}) => {
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('')
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Mock contact suggestions - in real app, this would come from contacts/email integration
  const mockContacts: ContactSuggestion[] = [
    { email: 'john.doe@company.com', name: 'John Doe', title: 'Product Manager', company: 'TechCorp', isFrequent: true },
    { email: 'sarah.wilson@company.com', name: 'Sarah Wilson', title: 'Designer', company: 'TechCorp', isFrequent: true },
    { email: 'mike.johnson@client.com', name: 'Mike Johnson', title: 'CEO', company: 'ClientCorp' },
    { email: 'conference.room.a@company.com', name: 'Conference Room A', company: 'TechCorp' }
  ]

  // Add attendee
  const addAttendee = useCallback((email: string, name?: string, isResource = false) => {
    if (!email || attendees.find(a => a.email === email)) return
    
    const newAttendee: EventAttendee = {
      email: email.trim().toLowerCase(),
      displayName: name || email.split('@')[0],
      responseStatus: 'needsAction',
      optional: false,
      isResource,
      self: email === organizerEmail
    }
    
    onChange([...attendees, newAttendee])
    setNewAttendeeEmail('')
    setShowSuggestions(false)
  }, [attendees, onChange, organizerEmail])

  // Remove attendee
  const removeAttendee = useCallback((email: string) => {
    onChange(attendees.filter(a => a.email !== email))
  }, [attendees, onChange])

  // Update attendee
  const updateAttendee = useCallback((email: string, updates: Partial<EventAttendee>) => {
    onChange(attendees.map(a => 
      a.email === email ? { ...a, ...updates } : a
    ))
  }, [attendees, onChange])

  // Search contacts
  const searchContacts = useCallback((query: string) => {
    if (!query.trim()) {
      setContactSuggestions([])
      return
    }

    const filtered = mockContacts.filter(contact =>
      contact.name.toLowerCase().includes(query.toLowerCase()) ||
      contact.email.toLowerCase().includes(query.toLowerCase()) ||
      contact.company?.toLowerCase().includes(query.toLowerCase())
    )

    setContactSuggestions(filtered.slice(0, 5))
  }, [])

  // Handle input change
  const handleEmailInputChange = (value: string) => {
    setNewAttendeeEmail(value)
    setShowSuggestions(value.length > 0)
    searchContacts(value)
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newAttendeeEmail) {
      e.preventDefault()
      addAttendee(newAttendeeEmail)
    }
  }

  // Get response status color
  const getResponseColor = (status: AttendeeResponseStatus) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'declined': return 'bg-red-100 text-red-800'
      case 'tentative': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Get response icon
  const getResponseIcon = (status: AttendeeResponseStatus) => {
    switch (status) {
      case 'accepted': return <UserCheck className="h-3 w-3" />
      case 'declined': return <UserX className="h-3 w-3" />
      case 'tentative': return <Clock className="h-3 w-3" />
      default: return <Mail className="h-3 w-3" />
    }
  }

  const requiredAttendees = attendees.filter(a => !a.optional && !a.isResource)
  const optionalAttendees = attendees.filter(a => a.optional && !a.isResource)
  const resources = attendees.filter(a => a.isResource)

  return (
    <div className="space-y-4">
      {/* Add Attendee Input */}
      {canEditAttendees && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Add Attendees</Label>
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Enter email address or name..."
                  value={newAttendeeEmail}
                  onChange={(e) => handleEmailInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-10"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                onClick={() => addAttendee(newAttendeeEmail)}
                disabled={!newAttendeeEmail.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Contact Suggestions */}
            {showSuggestions && contactSuggestions.length > 0 && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto">
                <div className="p-2">
                  {contactSuggestions.map((contact, index) => (
                    <div
                      key={contact.email}
                      className="flex items-center gap-3 p-2 hover:bg-accent cursor-pointer rounded"
                      onClick={() => addAttendee(contact.email, contact.name, contact.email.includes('room'))}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.email}</div>
                        {contact.title && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            {contact.title} {contact.company && `at ${contact.company}`}
                          </div>
                        )}
                      </div>
                      {contact.isFrequent && (
                        <Badge variant="secondary" className="text-xs">
                          Frequent
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Quick Add Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAttendee('conference.room.a@company.com', 'Conference Room A', true)}
            >
              <MapPin className="h-3 w-3 mr-1" />
              Add Room
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Add all frequent contacts
                mockContacts
                  .filter(c => c.isFrequent && !attendees.find(a => a.email === c.email))
                  .forEach(c => addAttendee(c.email, c.name))
              }}
            >
              <Users className="h-3 w-3 mr-1" />
              Add Team
            </Button>
          </div>
        </div>
      )}

      {/* Attendees List */}
      <Tabs defaultValue="required" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="required" className="text-sm">
            Required ({requiredAttendees.length})
          </TabsTrigger>
          <TabsTrigger value="optional" className="text-sm">
            Optional ({optionalAttendees.length})
          </TabsTrigger>
          <TabsTrigger value="resources" className="text-sm">
            Resources ({resources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="required" className="space-y-2 mt-4">
          {requiredAttendees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No required attendees yet</p>
            </div>
          ) : (
            requiredAttendees.map((attendee) => (
              <AttendeeCard
                key={attendee.email}
                attendee={attendee}
                onUpdate={(updates) => updateAttendee(attendee.email, updates)}
                onRemove={() => removeAttendee(attendee.email)}
                canEdit={canEditAttendees}
                getResponseColor={getResponseColor}
                getResponseIcon={getResponseIcon}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="optional" className="space-y-2 mt-4">
          {optionalAttendees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No optional attendees</p>
            </div>
          ) : (
            optionalAttendees.map((attendee) => (
              <AttendeeCard
                key={attendee.email}
                attendee={attendee}
                onUpdate={(updates) => updateAttendee(attendee.email, updates)}
                onRemove={() => removeAttendee(attendee.email)}
                canEdit={canEditAttendees}
                getResponseColor={getResponseColor}
                getResponseIcon={getResponseIcon}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-2 mt-4">
          {resources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No resources booked</p>
            </div>
          ) : (
            resources.map((resource) => (
              <AttendeeCard
                key={resource.email}
                attendee={resource}
                onUpdate={(updates) => updateAttendee(resource.email, updates)}
                onRemove={() => removeAttendee(resource.email)}
                canEdit={canEditAttendees}
                getResponseColor={getResponseColor}
                getResponseIcon={getResponseIcon}
                isResource
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Summary */}
      {attendees.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Total attendees: {attendees.filter(a => !a.isResource).length}
              {resources.length > 0 && ` • Resources: ${resources.length}`}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Accepted: {attendees.filter(a => a.responseStatus === 'accepted').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>Declined: {attendees.filter(a => a.responseStatus === 'declined').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span>Pending: {attendees.filter(a => a.responseStatus === 'needsAction').length}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// Attendee Card Component
interface AttendeeCardProps {
  attendee: EventAttendee
  onUpdate: (updates: Partial<EventAttendee>) => void
  onRemove: () => void
  canEdit: boolean
  getResponseColor: (status: AttendeeResponseStatus) => string
  getResponseIcon: (status: AttendeeResponseStatus) => React.ReactNode
  isResource?: boolean
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({
  attendee,
  onUpdate,
  onRemove,
  canEdit,
  getResponseColor,
  getResponseIcon,
  isResource = false
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            {isResource ? (
              <MapPin className="h-4 w-4" />
            ) : (
              attendee.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || 
              attendee.email.split('@')[0].slice(0, 2).toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {attendee.displayName || attendee.email.split('@')[0]}
            </span>
            {attendee.self && (
              <Badge variant="secondary" className="text-xs">You</Badge>
            )}
            {attendee.optional && !isResource && (
              <Badge variant="outline" className="text-xs">Optional</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {attendee.email}
          </div>
        </div>

        <Badge className={`text-xs flex items-center gap-1 ${getResponseColor(attendee.responseStatus)}`}>
          {getResponseIcon(attendee.responseStatus)}
          {attendee.responseStatus.charAt(0).toUpperCase() + attendee.responseStatus.slice(1).replace(/([A-Z])/g, ' $1')}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {canEdit && !attendee.self && (
          <>
            <div className="flex items-center space-x-2">
              <Switch
                checked={attendee.optional}
                onCheckedChange={(optional: boolean) => onUpdate({ optional })}
              />
              <Label className="text-xs">Optional</Label>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}