import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';
import {
  User,
  Mail,
  AtSign,
  Calendar,
  MapPin,
  Phone,
  Globe,
  Building,
  Briefcase,
  Users,
  UserPlus,
  Image,
  BadgeCheck,
  FileText,
  Brain,
  Plus,
  Trash2,
  Target,
  Lightbulb,
  Info,
  Heart,
  Bot,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { MemoryItem } from '../../types/chatTypes';

export interface UserProfileConfig {
  labels?: {
    title?: string;
    basicInfo?: string;
    customFields?: string;
    memories?: string;
    addMemory?: string;
    noMemories?: string;
    close?: string;
    noCustomFields?: string;
  };
}

export interface UserProfileUser {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

// Custom field definition - can be extended by login/external components
export interface CustomField {
  key: string;
  label: string;
  value: string | number | boolean | null | undefined;
  type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'number' | 'boolean';
  icon?: React.ReactNode;
}

export interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfileUser | null;
  /** Custom fields from userContext.customFields */
  customFields?: CustomField[] | Record<string, unknown>;
  /** User memories */
  memories?: MemoryItem[];
  config?: UserProfileConfig;
  /** Called when user wants to edit their profile */
  onEditProfile?: () => void;
  /** Called when user wants to logout */
  onLogout?: () => void;
  /** Called when user adds a memory */
  onAddMemory?: (content: string, category?: MemoryItem['category']) => void;
  /** Called when user updates a memory */
  onUpdateMemory?: (memoryId: string, content: string) => void;
  /** Called when user deletes a memory */
  onDeleteMemory?: (memoryId: string) => void;
  className?: string;
}

// Get initials from name or email
const getInitials = (name?: string, email?: string): string => {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return 'U';
};

// Map field types to icons
const getFieldIcon = (type?: string, key?: string): React.ReactNode => {
  const iconClass = 'h-4 w-4 text-muted-foreground';
  
  // Check by type first
  switch (type) {
    case 'email':
      return <Mail className={iconClass} />;
    case 'phone':
      return <Phone className={iconClass} />;
    case 'url':
      return <Globe className={iconClass} />;
    case 'date':
      return <Calendar className={iconClass} />;
  }
  
  // Check by common key names
  const lowerKey = key?.toLowerCase() || '';
  
  if (lowerKey.includes('follower')) return <Users className={iconClass} />;
  if (lowerKey.includes('following')) return <UserPlus className={iconClass} />;
  if (lowerKey.includes('post') || lowerKey.includes('publication')) return <Image className={iconClass} />;
  if (lowerKey.includes('verified') || lowerKey.includes('badge')) return <BadgeCheck className={iconClass} />;
  if (lowerKey.includes('bio')) return <FileText className={iconClass} />;
  
  // General fields
  if (lowerKey.includes('email')) return <Mail className={iconClass} />;
  if (lowerKey.includes('phone') || lowerKey.includes('tel')) return <Phone className={iconClass} />;
  if (lowerKey.includes('location') || lowerKey.includes('address') || lowerKey.includes('city')) return <MapPin className={iconClass} />;
  if (lowerKey.includes('company') || lowerKey.includes('org')) return <Building className={iconClass} />;
  if (lowerKey.includes('job') || lowerKey.includes('role') || lowerKey.includes('title') || lowerKey.includes('position')) return <Briefcase className={iconClass} />;
  if (lowerKey.includes('website') || lowerKey.includes('url') || lowerKey.includes('link')) return <Globe className={iconClass} />;
  if (lowerKey.includes('username') || lowerKey.includes('handle')) return <AtSign className={iconClass} />;
  if (lowerKey.includes('date') || lowerKey.includes('birthday') || lowerKey.includes('joined')) return <Calendar className={iconClass} />;
  
  return <User className={iconClass} />;
};

// Format value for display
const formatValue = (value: unknown, type?: string, key?: string): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') {
    if (key?.toLowerCase().includes('verified')) {
      return value ? 'Verified ✓' : 'Not verified';
    }
    return value ? 'Yes' : 'No';
  }
  if (type === 'date' && (typeof value === 'string' || typeof value === 'number')) {
    try {
      return new Date(value).toLocaleDateString('en-US');
    } catch {
      return String(value);
    }
  }
  return String(value);
};

// Convert Record<string, unknown> to CustomField[]
const normalizeCustomFields = (fields?: CustomField[] | Record<string, unknown>): CustomField[] => {
  if (!fields) return [];
  
  if (Array.isArray(fields)) {
    return fields;
  }
  
  // Convert object to array of fields
  return Object.entries(fields)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase())
        .trim(),
      value: value as string | number | boolean,
    }));
};

// Get icon for memory category
const getMemoryCategoryIcon = (category?: MemoryItem['category']): React.ReactNode => {
  const iconClass = 'h-4 w-4 text-muted-foreground';
  switch (category) {
    case 'preference':
      return <Heart className={iconClass} />;
    case 'fact':
      return <Info className={iconClass} />;
    case 'goal':
      return <Target className={iconClass} />;
    case 'context':
      return <Lightbulb className={iconClass} />;
    default:
      return <Brain className={iconClass} />;
  }
};

// Get label for memory category
const getMemoryCategoryLabel = (category?: MemoryItem['category']): string => {
  switch (category) {
    case 'preference':
      return 'Preferência';
    case 'fact':
      return 'Fato';
    case 'goal':
      return 'Meta';
    case 'context':
      return 'Contexto';
    default:
      return 'Outro';
  }
};

export const UserProfile: React.FC<UserProfileProps> = ({
  isOpen,
  onClose,
  user,
  customFields,
  memories = [],
  config,
  onEditProfile,
  onLogout,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  className,
}) => {
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState('');

  const handleAddMemory = () => {
    if (newMemoryContent.trim() && onAddMemory) {
      onAddMemory(newMemoryContent.trim(), 'other');
      setNewMemoryContent('');
      setIsAddingMemory(false);
    }
  };

  const handleStartEdit = (memory: MemoryItem) => {
    setEditingMemoryId(memory.id);
    setEditingMemoryContent(memory.content);
  };

  const handleSaveEdit = () => {
    if (editingMemoryId && editingMemoryContent.trim() && onUpdateMemory) {
      onUpdateMemory(editingMemoryId, editingMemoryContent.trim());
      setEditingMemoryId(null);
      setEditingMemoryContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMemoryId(null);
    setEditingMemoryContent('');
  };

  const labels = {
    title: config?.labels?.title || 'Profile',
    basicInfo: config?.labels?.basicInfo || 'Account',
    customFields: config?.labels?.customFields || 'Details',
    memories: config?.labels?.memories || 'Memories',
    addMemory: config?.labels?.addMemory || 'Add memory',
    noMemories: config?.labels?.noMemories || 'No memories yet',
    close: config?.labels?.close || 'Close',
    noCustomFields: config?.labels?.noCustomFields || 'No additional information',
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(user?.name, user?.email);
  const normalizedFields = normalizeCustomFields(customFields);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className={cn('w-full sm:max-w-md p-0 flex flex-col h-full overflow-hidden', className)}
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>{labels.title}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {/* User header */}
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="h-24 w-24 shrink-0">
                {user?.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="w-full px-2">
                <h2 className="text-xl font-semibold break-words">{displayName}</h2>
                {user?.email && (
                  <p className="text-sm text-muted-foreground break-words">{user.email}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Basic info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {labels.basicInfo}
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium break-words">{displayName}</p>
                  </div>
                </div>
                {user?.email && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <AtSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Handle</p>
                      <p className="text-sm font-medium break-words">{user.email}</p>
                    </div>
                  </div>
                )}
                {user?.id && user.id !== user?.name && user.id !== user?.email && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">ID</p>
                      <p className="text-sm font-medium break-words">{user.id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom fields */}
            {normalizedFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {labels.customFields}
                  </h3>
                  <div className="space-y-2">
                    {normalizedFields.map((field) => {
                      const isBioField = field.key.toLowerCase().includes('bio');
                      return (
                        <div
                          key={field.key}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="mt-0.5 shrink-0">
                            {field.icon || getFieldIcon(field.type, field.key)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">{field.label}</p>
                            <p className={cn(
                              "text-sm font-medium",
                              isBioField ? "whitespace-pre-wrap break-words" : "break-words"
                            )}>
                              {formatValue(field.value, field.type, field.key)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Memories section */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  {labels.memories}
                </h3>
                {onAddMemory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setIsAddingMemory(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Add memory input */}
              {isAddingMemory && onAddMemory && (
                <div className="flex gap-2">
                  <Input
                    value={newMemoryContent}
                    onChange={(e) => setNewMemoryContent(e.target.value)}
                    placeholder="O que devo lembrar?"
                    className="flex-1 h-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddMemory();
                      if (e.key === 'Escape') {
                        setIsAddingMemory(false);
                        setNewMemoryContent('');
                      }
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddMemory} disabled={!newMemoryContent.trim()}>
                    Salvar
                  </Button>
                </div>
              )}

              {/* Memory list */}
              <div className="space-y-2">
                {memories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {labels.noMemories}
                  </p>
                ) : (
                  memories.map((memory) => {
                    const isEditing = editingMemoryId === memory.id;
                    
                    return (
                      <div
                        key={memory.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 group"
                      >
                        <div className="mt-0.5 shrink-0">
                          {memory.source === 'agent' ? (
                            <Bot className="h-4 w-4 text-primary" />
                          ) : (
                            getMemoryCategoryIcon(memory.category)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-muted-foreground">
                              {getMemoryCategoryLabel(memory.category)}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {memory.source === 'agent' ? 'IA' : 'Você'}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingMemoryContent}
                                onChange={(e) => setEditingMemoryContent(e.target.value)}
                                className="min-h-[60px] text-sm resize-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    handleSaveEdit();
                                  }
                                  if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                              />
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={handleSaveEdit}
                                  disabled={!editingMemoryContent.trim()}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm break-words">{memory.content}</p>
                          )}
                        </div>
                        {!isEditing && (onUpdateMemory || onDeleteMemory) && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {onUpdateMemory && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleStartEdit(memory)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {onDeleteMemory && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onDeleteMemory(memory.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <div className="p-4 border-t space-y-2 shrink-0">
          {onEditProfile && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onEditProfile}
            >
              Edit Profile
            </Button>
          )}
          {onLogout && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={onLogout}
            >
              Log out
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserProfile;
