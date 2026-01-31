"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ChatHeader: () => ChatHeader,
  ChatInput: () => ChatInput,
  ChatUI: () => ChatUI,
  ChatUserContextProvider: () => ChatUserContextProvider,
  Message: () => Message,
  Sidebar: () => Sidebar2,
  ThreadManager: () => ThreadManager,
  UserMenu: () => UserMenu,
  UserProfile: () => UserProfile,
  chatConfigPresets: () => chatConfigPresets,
  chatUtils: () => chatUtils,
  cn: () => cn,
  configUtils: () => configUtils,
  defaultChatConfig: () => defaultChatConfig,
  featureFlags: () => featureFlags,
  formatDate: () => formatDate,
  mergeConfig: () => mergeConfig,
  themeUtils: () => themeUtils,
  useChatUserContext: () => useChatUserContext,
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(index_exports);

// src/components/chat/ChatUI.tsx
var import_react7 = require("react");

// src/config/chatConfig.ts
var defaultChatConfig = {
  branding: {
    logo: null,
    avatar: null,
    title: "Chat Assistant",
    subtitle: "How can I help you today?"
  },
  labels: {
    inputPlaceholder: "Type your message...",
    sendButton: "Send",
    sendMessageTooltip: "Send message",
    newThread: "New Conversation",
    deleteThread: "Delete Conversation",
    copyMessage: "Copy",
    editMessage: "Edit",
    regenerateMessage: "Regenerate",
    stopGeneration: "Stop",
    stopGenerationTooltip: "Stop generation",
    attachFiles: "Attach Files",
    attachFileTooltip: "Attach file",
    recordAudio: "Record Audio",
    recordAudioTooltip: "Record audio",
    // Header labels
    exportData: "Export data",
    importData: "Import data",
    clearAll: "Clear all",
    sidebarToggle: "Menu",
    customComponentToggle: "Toggle",
    settings: "Settings",
    toggleDarkMode: "Toggle Dark Mode",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    // Sidebar labels
    newChat: "New Conversation",
    search: "Search conversations...",
    customComponentLabel: "Custom",
    showArchived: "Show Archived",
    hideArchived: "Hide Archived",
    noThreadsFound: "No conversations found",
    noThreadsYet: "No conversations yet",
    deleteConfirmTitle: "Delete Conversation",
    deleteConfirmDescription: "Are you sure you want to delete this conversation? This action cannot be undone. All messages will be permanently lost.",
    renameThread: "Rename",
    archiveThread: "Archive",
    unarchiveThread: "Unarchive",
    today: "Today",
    yesterday: "Yesterday",
    createNewThread: "Create New Conversation",
    threadNamePlaceholder: "Conversation name (optional)",
    cancel: "Cancel",
    create: "Create Conversation",
    footerLabel: "Assistant can make mistakes. Check the AI results.",
    toolUsed: "Tool Used",
    daysAgo: "days ago",
    inputHelpText: "Press Enter to send, Shift+Enter to add a new line.",
    thinking: "Thinking...",
    defaultThreadName: "Main Thread"
  },
  features: {
    enableThreads: true,
    enableFileUpload: true,
    enableAudioRecording: true,
    enableMessageEditing: true,
    enableMessageCopy: true,
    enableRegeneration: true,
    enableToolCallsDisplay: true,
    maxAttachments: 4,
    maxFileSize: 10 * 1024 * 1024
    // 10MB
  },
  ui: {
    theme: "auto",
    showTimestamps: false,
    showAvatars: true,
    compactMode: false,
    showWordCount: false
  },
  customComponent: {},
  headerActions: null
};
function mergeConfig(_baseConfig, userConfig) {
  if (!userConfig) return defaultChatConfig;
  return {
    branding: {
      ...defaultChatConfig.branding,
      ...userConfig.branding
    },
    labels: {
      ...defaultChatConfig.labels,
      ...userConfig.labels
    },
    features: {
      ...defaultChatConfig.features,
      ...userConfig.features
    },
    ui: {
      ...defaultChatConfig.ui,
      ...userConfig.ui
    },
    customComponent: userConfig.customComponent || defaultChatConfig.customComponent,
    headerActions: userConfig.headerActions || defaultChatConfig.headerActions
  };
}
var chatConfigPresets = {
  minimal: {
    features: {
      enableThreads: false,
      enableFileUpload: false,
      enableAudioRecording: false,
      enableMessageEditing: false,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: false
    },
    ui: {
      compactMode: true,
      showTimestamps: false,
      showAvatars: false
    }
  },
  full: {
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: true,
      enableMessageEditing: true,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: true
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
      showWordCount: true
    }
  },
  developer: {
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: false,
      enableMessageEditing: true,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: true
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
      showWordCount: true
    }
  },
  customer_support: {
    branding: {
      title: "Customer Support",
      subtitle: "How can I help you today?"
    },
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: false,
      enableMessageEditing: false,
      enableMessageCopy: true,
      enableRegeneration: false,
      enableToolCallsDisplay: false
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false
    }
  }
};
function validateConfig(config) {
  const errors = [];
  if (config.features?.maxAttachments && config.features.maxAttachments < 1) {
    errors.push("maxAttachments must be at least 1");
  }
  if (config.features?.maxFileSize && config.features.maxFileSize < 1024) {
    errors.push("maxFileSize must be at least 1024 bytes (1KB)");
  }
  if (config.branding?.title && typeof config.branding.title !== "string") {
    errors.push("branding.title must be a string");
  }
  return errors;
}
var themeUtils = {
  getSystemTheme: () => {
    if (typeof globalThis.matchMedia === "undefined") return "light";
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  },
  resolveTheme: (theme) => {
    return theme === "auto" ? themeUtils.getSystemTheme() : theme;
  },
  applyTheme: (theme) => {
    if (typeof document === "undefined") return;
    const resolvedTheme = themeUtils.resolveTheme(theme);
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }
};
var featureFlags = {
  isEnabled: (config, feature) => {
    return config.features[feature] === true;
  },
  getEnabledFeatures: (config) => {
    return Object.entries(config.features).filter(([_, enabled]) => enabled === true).map(([feature]) => feature);
  },
  hasAnyFeature: (config, features) => {
    return features.some((feature) => featureFlags.isEnabled(config, feature));
  }
};
var configUtils = {
  createConfigHook: (config) => {
    return {
      config,
      isFeatureEnabled: (feature) => featureFlags.isEnabled(config, feature),
      getLabel: (key) => config.labels[key],
      getBranding: () => config.branding,
      getUI: () => config.ui
    };
  }
};

// src/components/chat/Message.tsx
var import_react = require("react");
var import_react_markdown = __toESM(require("react-markdown"), 1);
var import_remark_gfm = __toESM(require("remark-gfm"), 1);
var import_rehype_highlight = __toESM(require("rehype-highlight"), 1);

// src/components/ui/button.tsx
var import_react_slot = require("@radix-ui/react-slot");
var import_class_variance_authority = require("class-variance-authority");

// src/lib/utils.ts
var import_clsx = require("clsx");
var import_tailwind_merge = require("tailwind-merge");
function cn(...inputs) {
  return (0, import_tailwind_merge.twMerge)((0, import_clsx.clsx)(inputs));
}
var formatDate = (timestamp, labels) => {
  const date = new Date(timestamp);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  if (diffDays === 0) {
    return labels?.today || "Today";
  } else if (diffDays === 1) {
    return labels?.yesterday || "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} ${labels?.daysAgo || "days ago"}`;
  } else {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short"
    });
  }
};

// src/components/ui/button.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var buttonVariants = (0, import_class_variance_authority.cva)(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? import_react_slot.Slot : "button";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/components/ui/avatar.tsx
var AvatarPrimitive = __toESM(require("@radix-ui/react-avatar"), 1);
var import_jsx_runtime2 = require("react/jsx-runtime");
function Avatar({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    AvatarPrimitive.Root,
    {
      "data-slot": "avatar",
      className: cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      ),
      ...props
    }
  );
}
function AvatarImage({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    AvatarPrimitive.Image,
    {
      "data-slot": "avatar-image",
      className: cn("aspect-square size-full", className),
      ...props
    }
  );
}
function AvatarFallback({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    AvatarPrimitive.Fallback,
    {
      "data-slot": "avatar-fallback",
      className: cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      ),
      ...props
    }
  );
}

// src/components/ui/badge.tsx
var import_react_slot2 = require("@radix-ui/react-slot");
var import_class_variance_authority2 = require("class-variance-authority");
var import_jsx_runtime3 = require("react/jsx-runtime");
var badgeVariants = (0, import_class_variance_authority2.cva)(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? import_react_slot2.Slot : "span";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    Comp,
    {
      "data-slot": "badge",
      className: cn(badgeVariants({ variant }), className),
      ...props
    }
  );
}

// src/components/ui/card.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function Card({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      "data-slot": "card",
      className: cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      ),
      ...props
    }
  );
}
function CardHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      "data-slot": "card-header",
      className: cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      ),
      ...props
    }
  );
}
function CardTitle({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      "data-slot": "card-title",
      className: cn("leading-none font-semibold", className),
      ...props
    }
  );
}
function CardContent({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      "data-slot": "card-content",
      className: cn("px-6", className),
      ...props
    }
  );
}

// src/components/ui/textarea.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Textarea({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "textarea",
    {
      "data-slot": "textarea",
      className: cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      ),
      ...props
    }
  );
}

// src/components/ui/tooltip.tsx
var TooltipPrimitive = __toESM(require("@radix-ui/react-tooltip"), 1);
var import_jsx_runtime6 = require("react/jsx-runtime");
function TooltipProvider({
  delayDuration = 0,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    TooltipPrimitive.Provider,
    {
      "data-slot": "tooltip-provider",
      delayDuration,
      ...props
    }
  );
}
function Tooltip({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipPrimitive.Root, { "data-slot": "tooltip", ...props }) });
}
function TooltipTrigger({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipPrimitive.Trigger, { "data-slot": "tooltip-trigger", ...props });
}
function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipPrimitive.Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    TooltipPrimitive.Content,
    {
      "data-slot": "tooltip-content",
      sideOffset,
      className: cn(
        "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipPrimitive.Arrow, { className: "bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" })
      ]
    }
  ) });
}

// src/components/chat/Message.tsx
var import_lucide_react = require("lucide-react");
var import_jsx_runtime7 = require("react/jsx-runtime");
var ThinkingIndicator = ({ label = "Thinking..." }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2 py-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex gap-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "span",
        {
          className: "inline-block w-2 h-2 bg-primary rounded-full animate-bounce",
          style: { animationDelay: "0ms" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "span",
        {
          className: "inline-block w-2 h-2 bg-primary rounded-full animate-bounce",
          style: { animationDelay: "150ms" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "span",
        {
          className: "inline-block w-2 h-2 bg-primary rounded-full animate-bounce",
          style: { animationDelay: "300ms" }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "text-sm text-muted-foreground animate-pulse", children: label })
  ] });
};
var StreamingText = ({
  content,
  isStreaming = false,
  thinkingLabel = "Thinking..."
}) => {
  const hasContent = content.trim().length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "prose prose-sm max-w-none dark:prose-invert", children: [
    hasContent ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_react_markdown.default,
      {
        remarkPlugins: [import_remark_gfm.default],
        rehypePlugins: isStreaming ? [] : [import_rehype_highlight.default],
        components: {
          code: ({ node, className, children, ...props }) => {
            const inline = props.inline;
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: "relative", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { className, ...props, children }) }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { className: "bg-muted px-1 py-0.5 rounded text-sm", ...props, children });
          }
        },
        children: content
      }
    ) : isStreaming ? (
      // Show thinking indicator while waiting for first token
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ThinkingIndicator, { label: thinkingLabel })
    ) : null,
    isStreaming && hasContent && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "inline-block w-2 h-4 bg-primary animate-pulse ml-1" })
  ] });
};
var MediaRenderer = ({ attachment }) => {
  const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
  const audioRef = (0, import_react.useRef)(null);
  const videoRef = (0, import_react.useRef)(null);
  const togglePlayback = () => {
    if (attachment.kind === "audio" && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (attachment.kind === "video" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  const formatDuration = (ms) => {
    if (!ms) return "";
    const seconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  switch (attachment.kind) {
    case "image":
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "relative rounded-lg overflow-hidden border bg-muted/20 max-w-md", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "img",
          {
            src: attachment.dataUrl,
            alt: attachment.fileName || "Attachment",
            className: "w-full h-auto object-cover",
            loading: "lazy"
          }
        ),
        attachment.fileName && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2", children: attachment.fileName })
      ] });
    case "audio":
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "flex w-full max-w-md py-0 min-w-64 items-center gap-3", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "audio",
        {
          ref: audioRef,
          src: attachment.dataUrl,
          onPlay: () => setIsPlaying(true),
          onPause: () => setIsPlaying(false),
          onEnded: () => setIsPlaying(false),
          className: "w-full mt-2",
          controls: true
        }
      ) });
    case "video":
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "relative rounded-lg overflow-hidden border bg-muted/20 max-w-lg", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "video",
          {
            ref: videoRef,
            src: attachment.dataUrl,
            poster: attachment.poster,
            controls: true,
            className: "w-full h-auto",
            onPlay: () => setIsPlaying(true),
            onPause: () => setIsPlaying(false),
            onEnded: () => setIsPlaying(false)
          }
        ),
        attachment.fileName && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2", children: attachment.fileName })
      ] });
    default:
      return null;
  }
};
var ToolCallsDisplay = ({ toolCalls, label }) => {
  const [expandedCall, setExpandedCall] = (0, import_react.useState)(null);
  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Clock, { className: "h-3 w-3 text-muted-foreground" });
      case "running":
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" });
      case "completed":
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Check, { className: "h-3 w-3 text-green-500" });
      case "failed":
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.X, { className: "h-3 w-3 text-destructive" });
    }
  };
  const getStatusBadgeClasses = (status) => {
    switch (status) {
      case "pending":
        return "bg-muted text-muted-foreground";
      case "running":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "space-y-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Wrench, { className: "h-3 w-3" }),
      label || "Ferramenta utilizada"
    ] }),
    toolCalls.map((call) => {
      const isExpanded = expandedCall === call.id;
      const ToggleIcon = isExpanded ? import_lucide_react.ChevronDown : import_lucide_react.ChevronRight;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card, { className: "border border-dashed border-primary/40 bg-card/60", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "button",
          {
            type: "button",
            className: "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
            onClick: () => setExpandedCall(isExpanded ? null : call.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2", children: [
                getStatusIcon(call.status),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "font-medium text-sm", children: call.name }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Badge, { variant: "secondary", className: getStatusBadgeClasses(call.status), children: call.status })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ToggleIcon, { className: "h-4 w-4 text-muted-foreground" })
            ]
          }
        ),
        isExpanded && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(CardContent, { className: "pt-0 pb-3 px-3 text-xs space-y-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "font-medium text-muted-foreground mb-1", children: "Args" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: "rounded bg-muted p-2 overflow-x-auto text-xs", children: JSON.stringify(call.arguments, null, 2) })
          ] }),
          typeof call.result !== "undefined" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "font-medium text-muted-foreground mb-1", children: "Result" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: "rounded bg-muted p-2 overflow-x-auto text-xs", children: JSON.stringify(call.result, null, 2) })
          ] }),
          call.startTime && call.endTime && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "text-muted-foreground", children: [
            "Executed in ",
            call.endTime - call.startTime,
            "ms"
          ] })
        ] })
      ] }, call.id);
    })
  ] });
};
var Message = ({
  message,
  isUser,
  userAvatar,
  userName = "Voc\xEA",
  assistantAvatar,
  assistantName = "Assistente",
  showTimestamp = false,
  showAvatar = true,
  enableCopy = true,
  enableEdit = true,
  enableRegenerate = true,
  enableToolCallsDisplay = false,
  compactMode = false,
  onAction,
  className = "",
  toolUsedLabel,
  thinkingLabel = "Thinking..."
}) => {
  const [isEditing, setIsEditing] = (0, import_react.useState)(false);
  const [editContent, setEditContent] = (0, import_react.useState)(message.content);
  const [showActions, setShowActions] = (0, import_react.useState)(false);
  const [copied, setCopied] = (0, import_react.useState)(false);
  const messageIsUser = isUser ?? message.role === "user";
  const canEdit = enableEdit && messageIsUser;
  const canRegenerate = enableRegenerate && !messageIsUser;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
      onAction?.({ action: "copy", messageId: message.id, content: message.content });
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };
  const handleEdit = () => {
    if (isEditing) {
      if (editContent.trim() !== message.content) {
        onAction?.({ action: "edit", messageId: message.id, content: editContent.trim() });
      }
      setIsEditing(false);
    } else {
      setEditContent(message.content);
      setIsEditing(true);
    }
  };
  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };
  const handleRegenerate = () => {
    onAction?.({ action: "regenerate", messageId: message.id });
  };
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      className: `flex w-full flex-col ${className} max-w-[800px] mx-auto`,
      onMouseEnter: () => setShowActions(true),
      onMouseLeave: () => setShowActions(false),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `flex gap-3 ${messageIsUser ? "flex-row-reverse" : "flex-row"} w-full mb-1`, children: [
          showAvatar && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: `flex-shrink-0 ${compactMode ? "mt-1" : "mt-0"}`, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Avatar, { className: compactMode ? "h-6 w-6" : "h-8 w-8", children: messageIsUser ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AvatarImage, { src: userAvatar, alt: userName }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AvatarFallback, { className: "bg-primary text-primary-foreground", children: userName.charAt(0).toUpperCase() })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, { children: assistantAvatar || /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AvatarFallback, { className: "bg-secondary text-secondary-foreground", children: "AI" }) }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `flex items-center gap-2 mb-1 ${messageIsUser ? "flex-row-reverse" : "flex-row"}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: `font-medium ${compactMode ? "text-sm" : "text-base"}`, children: messageIsUser ? userName : assistantName }),
            showTimestamp && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "text-xs text-muted-foreground", children: formatTime(message.timestamp) }),
            message.isEdited && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Badge, { variant: "outline", className: "text-xs", children: "editado" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: `flex-1 min-w-0 ${messageIsUser ? "text-right" : "text-left"}`, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `relative inline-flex flex-col ${messageIsUser ? "rounded-lg p-3 bg-primary text-primary-foreground ml-auto max-w-[85%]" : "max-w-[85%]"}`, children: [
          isEditing ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "space-y-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              Textarea,
              {
                value: editContent,
                onChange: (e) => setEditContent(e.target.value),
                className: "min-h-[100px] resize-none",
                autoFocus: true
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex gap-2 justify-end", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Button, { variant: "outline", size: "sm", onClick: handleCancelEdit, children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.X, { className: "h-4 w-4 mr-1" }),
                "Cancelar"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Button, { size: "sm", onClick: handleEdit, children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Check, { className: "h-4 w-4 mr-1" }),
                "Salvar"
              ] })
            ] })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            enableToolCallsDisplay && message.toolCalls && message.toolCalls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mb-3", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ToolCallsDisplay, { toolCalls: message.toolCalls, label: toolUsedLabel }) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              StreamingText,
              {
                content: message.content,
                isStreaming: message.isStreaming,
                thinkingLabel
              }
            ),
            message.attachments && message.attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mt-3 space-y-2", children: message.attachments.map((attachment, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MediaRenderer, { attachment }, index)) })
          ] }),
          !isEditing && (showActions || copied) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `absolute -top-2 flex gap-1 ${messageIsUser ? "-left-2" : "-right-2"}`, children: [
            enableCopy && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Tooltip, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                Button,
                {
                  variant: "secondary",
                  size: "icon",
                  className: "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  onClick: handleCopy,
                  children: copied ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Check, { className: "h-3 w-3 text-green-500" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Copy, { className: "h-3 w-3" })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipContent, { children: copied ? "Copiado!" : "Copiar" })
            ] }),
            canEdit && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Tooltip, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                Button,
                {
                  variant: "secondary",
                  size: "icon",
                  className: "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  onClick: handleEdit,
                  children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.Edit, { className: "h-3 w-3" })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipContent, { children: "Editar" })
            ] }),
            canRegenerate && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Tooltip, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                Button,
                {
                  variant: "secondary",
                  size: "icon",
                  className: "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  onClick: handleRegenerate,
                  children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.RotateCcw, { className: "h-3 w-3" })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TooltipContent, { children: "Regenerar" })
            ] })
          ] })
        ] }) })
      ]
    }
  ) });
};

// src/components/chat/Sidebar.tsx
var import_react2 = require("react");

// src/components/ui/input.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "input",
    {
      type,
      "data-slot": "input",
      className: cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

// src/components/ui/sidebar.tsx
var React3 = __toESM(require("react"), 1);
var import_react_slot3 = require("@radix-ui/react-slot");
var import_class_variance_authority3 = require("class-variance-authority");
var import_lucide_react3 = require("lucide-react");

// src/hooks/use-mobile.ts
var React2 = __toESM(require("react"), 1);
var MOBILE_BREAKPOINT = 768;
function useIsMobile() {
  const [isMobile, setIsMobile] = React2.useState(void 0);
  React2.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMobile;
}

// src/components/ui/separator.tsx
var SeparatorPrimitive = __toESM(require("@radix-ui/react-separator"), 1);
var import_jsx_runtime9 = require("react/jsx-runtime");
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    SeparatorPrimitive.Root,
    {
      "data-slot": "separator",
      decorative,
      orientation,
      className: cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      ),
      ...props
    }
  );
}

// src/components/ui/sheet.tsx
var SheetPrimitive = __toESM(require("@radix-ui/react-dialog"), 1);
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime10 = require("react/jsx-runtime");
function Sheet({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    SheetPrimitive.Overlay,
    {
      "data-slot": "sheet-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(SheetPortal, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SheetOverlay, {}),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      SheetPrimitive.Content,
      {
        "data-slot": "sheet-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" && "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" && "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" && "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        ),
        ...props,
        children: [
          children,
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(SheetPrimitive.Close, { className: "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_lucide_react2.XIcon, { className: "size-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "div",
    {
      "data-slot": "sheet-header",
      className: cn("flex flex-col gap-1.5 p-4", className),
      ...props
    }
  );
}
function SheetTitle({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    SheetPrimitive.Title,
    {
      "data-slot": "sheet-title",
      className: cn("text-foreground font-semibold", className),
      ...props
    }
  );
}
function SheetDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    SheetPrimitive.Description,
    {
      "data-slot": "sheet-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/components/ui/sidebar.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var SIDEBAR_COOKIE_NAME = "sidebar_state";
var SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
var SIDEBAR_WIDTH = "16rem";
var SIDEBAR_WIDTH_MOBILE = "18rem";
var SIDEBAR_WIDTH_ICON = "3rem";
var SIDEBAR_KEYBOARD_SHORTCUT = "b";
var SidebarContext = React3.createContext(null);
function useSidebar() {
  const context = React3.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}
function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React3.useState(false);
  const [_open, _setOpen] = React3.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React3.useCallback(
    (value) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open]
  );
  const toggleSidebar = React3.useCallback(() => {
    return isMobile ? setOpenMobile((open2) => !open2) : setOpen((open2) => !open2);
  }, [isMobile, setOpen, setOpenMobile]);
  React3.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);
  const state = open ? "expanded" : "collapsed";
  const contextValue = React3.useMemo(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SidebarContext.Provider, { value: contextValue, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(TooltipProvider, { delayDuration: 0, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-wrapper",
      style: {
        "--sidebar-width": SIDEBAR_WIDTH,
        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
        ...style
      },
      className: cn(
        "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
        className
      ),
      ...props,
      children
    }
  ) }) });
}
function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  if (collapsible === "none") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        "data-slot": "sidebar",
        className: cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className
        ),
        ...props,
        children
      }
    );
  }
  if (isMobile) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Sheet, { open: openMobile, onOpenChange: setOpenMobile, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
      SheetContent,
      {
        "data-sidebar": "sidebar",
        "data-slot": "sidebar",
        "data-mobile": "true",
        className: "bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden",
        style: {
          "--sidebar-width": SIDEBAR_WIDTH_MOBILE
        },
        side,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(SheetHeader, { className: "sr-only", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SheetTitle, { children: "Sidebar" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SheetDescription, { children: "Displays the mobile sidebar." })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "flex h-full w-full flex-col", children })
        ]
      }
    ) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    "div",
    {
      className: "group peer text-sidebar-foreground hidden md:block",
      "data-state": state,
      "data-collapsible": state === "collapsed" ? collapsible : "",
      "data-variant": variant,
      "data-side": side,
      "data-slot": "sidebar",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "div",
          {
            "data-slot": "sidebar-gap",
            className: cn(
              "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
              "group-data-[collapsible=offcanvas]:w-0",
              "group-data-[side=right]:rotate-180",
              variant === "floating" || variant === "inset" ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "div",
          {
            "data-slot": "sidebar-container",
            className: cn(
              "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
              side === "left" ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]" : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
              // Adjust the padding for floating and inset variants.
              variant === "floating" || variant === "inset" ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
              className
            ),
            ...props,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "div",
              {
                "data-sidebar": "sidebar",
                "data-slot": "sidebar-inner",
                className: "bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm",
                children
              }
            )
          }
        )
      ]
    }
  );
}
function SidebarTrigger({
  className,
  onClick,
  ...props
}) {
  const { toggleSidebar } = useSidebar();
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    Button,
    {
      "data-sidebar": "trigger",
      "data-slot": "sidebar-trigger",
      variant: "ghost",
      size: "icon",
      className: cn("size-7", className),
      onClick: (event) => {
        onClick?.(event);
        toggleSidebar();
      },
      ...props,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react3.PanelLeftIcon, {}),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "sr-only", children: "Toggle Sidebar" })
      ]
    }
  );
}
function SidebarRail({ className, ...props }) {
  const { toggleSidebar } = useSidebar();
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "button",
    {
      "data-sidebar": "rail",
      "data-slot": "sidebar-rail",
      "aria-label": "Toggle Sidebar",
      tabIndex: -1,
      onClick: toggleSidebar,
      title: "Toggle Sidebar",
      className: cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      ),
      ...props
    }
  );
}
function SidebarInset({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "main",
    {
      "data-slot": "sidebar-inset",
      className: cn(
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      ),
      ...props
    }
  );
}
function SidebarHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-header",
      "data-sidebar": "header",
      className: cn("flex flex-col gap-2 p-2", className),
      ...props
    }
  );
}
function SidebarFooter({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-footer",
      "data-sidebar": "footer",
      className: cn("flex flex-col gap-2 p-2", className),
      ...props
    }
  );
}
function SidebarContent({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-content",
      "data-sidebar": "content",
      className: cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      ),
      ...props
    }
  );
}
function SidebarGroup({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-group",
      "data-sidebar": "group",
      className: cn("relative flex w-full min-w-0 flex-col p-2", className),
      ...props
    }
  );
}
function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? import_react_slot3.Slot : "div";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    Comp,
    {
      "data-slot": "sidebar-group-label",
      "data-sidebar": "group-label",
      className: cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      ),
      ...props
    }
  );
}
function SidebarGroupContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      "data-slot": "sidebar-group-content",
      "data-sidebar": "group-content",
      className: cn("w-full text-sm", className),
      ...props
    }
  );
}
function SidebarMenu({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "ul",
    {
      "data-slot": "sidebar-menu",
      "data-sidebar": "menu",
      className: cn("flex w-full min-w-0 flex-col gap-1", className),
      ...props
    }
  );
}
function SidebarMenuItem({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "li",
    {
      "data-slot": "sidebar-menu-item",
      "data-sidebar": "menu-item",
      className: cn("group/menu-item relative", className),
      ...props
    }
  );
}
var sidebarMenuButtonVariants = (0, import_class_variance_authority3.cva)(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline: "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}) {
  const Comp = asChild ? import_react_slot3.Slot : "button";
  const { isMobile, state } = useSidebar();
  const button = /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    Comp,
    {
      "data-slot": "sidebar-menu-button",
      "data-sidebar": "menu-button",
      "data-size": size,
      "data-active": isActive,
      className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      ...props
    }
  );
  if (!tooltip) {
    return button;
  }
  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip
    };
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(Tooltip, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(TooltipTrigger, { asChild: true, children: button }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      TooltipContent,
      {
        side: "right",
        align: "center",
        hidden: state !== "collapsed" || isMobile,
        ...tooltip
      }
    )
  ] });
}
function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}) {
  const Comp = asChild ? import_react_slot3.Slot : "button";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    Comp,
    {
      "data-slot": "sidebar-menu-action",
      "data-sidebar": "menu-action",
      className: cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover && "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      ),
      ...props
    }
  );
}

// src/components/ui/dialog.tsx
var DialogPrimitive = __toESM(require("@radix-ui/react-dialog"), 1);
var import_lucide_react4 = require("lucide-react");
var import_jsx_runtime12 = require("react/jsx-runtime");
function Dialog({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(DialogPrimitive.Root, { "data-slot": "dialog", ...props });
}
function DialogTrigger({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(DialogPrimitive.Trigger, { "data-slot": "dialog-trigger", ...props });
}
function DialogPortal({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(DialogPrimitive.Portal, { "data-slot": "dialog-portal", ...props });
}
function DialogOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    DialogPrimitive.Overlay,
    {
      "data-slot": "dialog-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(DialogPortal, { "data-slot": "dialog-portal", children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(DialogOverlay, {}),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      DialogPrimitive.Content,
      {
        "data-slot": "dialog-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        ),
        ...props,
        children: [
          children,
          showCloseButton && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            DialogPrimitive.Close,
            {
              "data-slot": "dialog-close",
              className: "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react4.XIcon, {}),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "sr-only", children: "Close" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function DialogHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    "div",
    {
      "data-slot": "dialog-header",
      className: cn("flex flex-col gap-2 text-center sm:text-left", className),
      ...props
    }
  );
}
function DialogFooter({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    "div",
    {
      "data-slot": "dialog-footer",
      className: cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      ),
      ...props
    }
  );
}
function DialogTitle({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    DialogPrimitive.Title,
    {
      "data-slot": "dialog-title",
      className: cn("text-lg leading-none font-semibold", className),
      ...props
    }
  );
}
function DialogDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    DialogPrimitive.Description,
    {
      "data-slot": "dialog-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/components/ui/alert-dialog.tsx
var AlertDialogPrimitive = __toESM(require("@radix-ui/react-alert-dialog"), 1);
var import_jsx_runtime13 = require("react/jsx-runtime");
function AlertDialog({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(AlertDialogPrimitive.Root, { "data-slot": "alert-dialog", ...props });
}
function AlertDialogPortal({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(AlertDialogPrimitive.Portal, { "data-slot": "alert-dialog-portal", ...props });
}
function AlertDialogOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    AlertDialogPrimitive.Overlay,
    {
      "data-slot": "alert-dialog-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function AlertDialogContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(AlertDialogPortal, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(AlertDialogOverlay, {}),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      AlertDialogPrimitive.Content,
      {
        "data-slot": "alert-dialog-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        ),
        ...props
      }
    )
  ] });
}
function AlertDialogHeader({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    "div",
    {
      "data-slot": "alert-dialog-header",
      className: cn("flex flex-col gap-2 text-center sm:text-left", className),
      ...props
    }
  );
}
function AlertDialogFooter({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    "div",
    {
      "data-slot": "alert-dialog-footer",
      className: cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      ),
      ...props
    }
  );
}
function AlertDialogTitle({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    AlertDialogPrimitive.Title,
    {
      "data-slot": "alert-dialog-title",
      className: cn("text-lg font-semibold", className),
      ...props
    }
  );
}
function AlertDialogDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    AlertDialogPrimitive.Description,
    {
      "data-slot": "alert-dialog-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}
function AlertDialogAction({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    AlertDialogPrimitive.Action,
    {
      className: cn(buttonVariants(), className),
      ...props
    }
  );
}
function AlertDialogCancel({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    AlertDialogPrimitive.Cancel,
    {
      className: cn(buttonVariants({ variant: "outline" }), className),
      ...props
    }
  );
}

// src/components/ui/dropdown-menu.tsx
var DropdownMenuPrimitive = __toESM(require("@radix-ui/react-dropdown-menu"), 1);
var import_lucide_react5 = require("lucide-react");
var import_jsx_runtime14 = require("react/jsx-runtime");
function DropdownMenu({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(DropdownMenuPrimitive.Root, { "data-slot": "dropdown-menu", ...props });
}
function DropdownMenuTrigger({
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    DropdownMenuPrimitive.Trigger,
    {
      "data-slot": "dropdown-menu-trigger",
      ...props
    }
  );
}
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    DropdownMenuPrimitive.Content,
    {
      "data-slot": "dropdown-menu-content",
      sideOffset,
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      ),
      ...props
    }
  ) });
}
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    DropdownMenuPrimitive.Item,
    {
      "data-slot": "dropdown-menu-item",
      "data-inset": inset,
      "data-variant": variant,
      className: cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuLabel({
  className,
  inset,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    DropdownMenuPrimitive.Label,
    {
      "data-slot": "dropdown-menu-label",
      "data-inset": inset,
      className: cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuSeparator({
  className,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    DropdownMenuPrimitive.Separator,
    {
      "data-slot": "dropdown-menu-separator",
      className: cn("bg-border -mx-1 my-1 h-px", className),
      ...props
    }
  );
}

// src/components/chat/Sidebar.tsx
var import_lucide_react7 = require("lucide-react");

// src/components/chat/UserMenu.tsx
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime15 = require("react/jsx-runtime");
var getInitials = (name, email) => {
  if (name) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
};
var getDisplayName = (user, guestLabel) => {
  if (!user) return guestLabel || "Guest";
  return user.name || user.email?.split("@")[0] || guestLabel || "Guest";
};
var UserMenu = ({
  user,
  config,
  callbacks,
  currentTheme = "system",
  showThemeOptions = true,
  additionalItems
}) => {
  const { isMobile } = useSidebar();
  const labels = {
    profile: config?.labels?.profile || "Profile",
    settings: config?.labels?.settings || "Settings",
    theme: config?.labels?.theme || "Theme",
    lightMode: config?.labels?.lightMode || "Light",
    darkMode: config?.labels?.darkMode || "Dark",
    systemTheme: config?.labels?.systemTheme || "System",
    logout: config?.labels?.logout || "Log out",
    guest: config?.labels?.guest || "Guest"
  };
  const displayName = getDisplayName(user, labels.guest);
  const initials = getInitials(user?.name, user?.email);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SidebarMenu, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SidebarMenuItem, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(DropdownMenu, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      SidebarMenuButton,
      {
        size: "lg",
        className: "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
        tooltip: displayName,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Avatar, { className: "h-8 w-8 rounded-lg", children: [
            user?.avatar && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AvatarImage, { src: user.avatar, alt: displayName }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AvatarFallback, { className: "rounded-lg bg-primary/10 text-primary text-xs font-medium", children: initials })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate font-medium", children: displayName }),
            user?.email && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-xs text-muted-foreground", children: user.email })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.ChevronsUpDown, { className: "ml-auto size-4 group-data-[collapsible=icon]:hidden" })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      DropdownMenuContent,
      {
        className: "w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg",
        side: isMobile ? "bottom" : "right",
        align: "end",
        sideOffset: 4,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DropdownMenuLabel, { className: "p-0 font-normal", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex items-center gap-2 px-1 py-1.5 text-left text-sm", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Avatar, { className: "h-8 w-8 rounded-lg", children: [
              user?.avatar && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AvatarImage, { src: user.avatar, alt: displayName }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AvatarFallback, { className: "rounded-lg bg-primary/10 text-primary text-xs font-medium", children: initials })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "grid flex-1 text-left text-sm leading-tight", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate font-medium", children: displayName }),
              user?.email && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-xs text-muted-foreground", children: user.email })
            ] })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DropdownMenuSeparator, {}),
          callbacks?.onViewProfile && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(DropdownMenuItem, { onClick: callbacks.onViewProfile, children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.User, { className: "mr-2 h-4 w-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.profile })
          ] }),
          callbacks?.onOpenSettings && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(DropdownMenuItem, { onClick: callbacks.onOpenSettings, children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.Settings, { className: "mr-2 h-4 w-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.settings })
          ] }),
          additionalItems,
          showThemeOptions && callbacks?.onThemeChange && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DropdownMenuSeparator, {}),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              DropdownMenuItem,
              {
                onClick: () => callbacks.onThemeChange?.("light"),
                className: currentTheme === "light" ? "bg-accent" : "",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.Sun, { className: "mr-2 h-4 w-4" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.lightMode })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              DropdownMenuItem,
              {
                onClick: () => callbacks.onThemeChange?.("dark"),
                className: currentTheme === "dark" ? "bg-accent" : "",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.Moon, { className: "mr-2 h-4 w-4" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.darkMode })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              DropdownMenuItem,
              {
                onClick: () => callbacks.onThemeChange?.("system"),
                className: currentTheme === "system" ? "bg-accent" : "",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.Palette, { className: "mr-2 h-4 w-4" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.systemTheme })
                ]
              }
            )
          ] }),
          callbacks?.onLogout && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DropdownMenuSeparator, {}),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              DropdownMenuItem,
              {
                onClick: callbacks.onLogout,
                className: "text-destructive focus:text-destructive focus:bg-destructive/10",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react6.LogOut, { className: "mr-2 h-4 w-4" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: labels.logout })
                ]
              }
            )
          ] })
        ]
      }
    )
  ] }) }) });
};

// src/components/chat/Sidebar.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var CreateThreadDialog = ({ config, onCreateThread, trigger }) => {
  const [title, setTitle] = (0, import_react2.useState)("");
  const [isOpen, setIsOpen] = (0, import_react2.useState)(false);
  const handleCreate = () => {
    onCreateThread(title.trim() || void 0);
    setTitle("");
    setIsOpen(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(DialogTrigger, { asChild: true, children: trigger || /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(Button, { className: "w-full justify-start", variant: "outline", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Plus, { className: "mr-2 h-4 w-4" }),
      config.labels?.newChat || "New Chat"
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DialogContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DialogHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(DialogTitle, { children: config.labels?.createNewThread || "New Conversation" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(DialogDescription, { children: "Give your new conversation a name or leave blank to auto-generate one." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        Input,
        {
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: config.labels?.threadNamePlaceholder || "Conversation name",
          onKeyDown: (e) => e.key === "Enter" && handleCreate(),
          autoFocus: true
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DialogFooter, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Button, { variant: "outline", onClick: () => setIsOpen(false), children: config.labels?.cancel || "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Button, { onClick: handleCreate, children: config.labels?.create || "Create" })
      ] })
    ] })
  ] });
};
var ThreadInitialsIcon = ({ title }) => {
  const initials = title?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "flex shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium", children: initials });
};
var Sidebar2 = ({
  threads,
  currentThreadId,
  config,
  onCreateThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  // User menu props
  user,
  userMenuCallbacks,
  currentTheme,
  showThemeOptions = true,
  userMenuAdditionalItems,
  ...props
}) => {
  const [searchQuery, setSearchQuery] = (0, import_react2.useState)("");
  const [showArchived, setShowArchived] = (0, import_react2.useState)(false);
  const [deleteThreadId, setDeleteThreadId] = (0, import_react2.useState)(null);
  const [editingThreadId, setEditingThreadId] = (0, import_react2.useState)(null);
  const [editTitle, setEditTitle] = (0, import_react2.useState)("");
  const inputRef = (0, import_react2.useRef)(null);
  const { setOpen } = useSidebar();
  (0, import_react2.useEffect)(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);
  const filteredThreads = threads.filter((thread) => {
    const title = (thread.title ?? "").toString();
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchiveFilter = showArchived || !thread.isArchived;
    return matchesSearch && matchesArchiveFilter;
  });
  const groupedThreads = filteredThreads.reduce((groups, thread) => {
    const date = new Date(thread.updatedAt);
    const today = /* @__PURE__ */ new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1e3);
    let groupKey;
    if (date.toDateString() === today.toDateString()) {
      groupKey = config.labels?.today || "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = config.labels?.yesterday || "Yesterday";
    } else {
      groupKey = date.toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long"
      });
    }
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(thread);
    return groups;
  }, {});
  const handleDeleteThread = (threadId) => {
    onDeleteThread?.(threadId);
    setDeleteThreadId(null);
  };
  const startEditing = (thread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title || "");
  };
  const saveEdit = () => {
    if (editingThreadId && editTitle.trim()) {
      onRenameThread?.(editingThreadId, editTitle.trim());
    }
    setEditingThreadId(null);
  };
  const cancelEdit = () => {
    setEditingThreadId(null);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(Sidebar, { collapsible: "icon", ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(SidebarHeader, { children: [
      onCreateThread && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        CreateThreadDialog,
        {
          config,
          onCreateThread,
          trigger: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarMenu, { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarMenuItem, { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            SidebarMenuButton,
            {
              size: "lg",
              className: "w-full justify-start gap-2 border border-sidebar-border shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center",
              tooltip: config.labels?.newChat || "New Chat",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Plus, { className: "size-4" }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "group-data-[collapsible=icon]:hidden", children: config.labels?.newChat || "New Chat" })
              ]
            }
          ) }) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "px-2 py-1 mt-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "relative group-data-[collapsible=icon]:hidden", children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Search, { className: "pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
            Input,
            {
              className: "pl-8 h-8 bg-sidebar-accent/50 border-sidebar-border focus-visible:ring-1 focus-visible:ring-sidebar-ring",
              placeholder: config.labels?.search || "Search...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "hidden group-data-[collapsible=icon]:flex justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
          Button,
          {
            variant: "ghost",
            size: "icon",
            className: "h-7 w-7",
            onClick: () => setOpen(true),
            title: config.labels?.search || "Search",
            children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Search, { className: "h-4 w-4" })
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(SidebarContent, { children: [
      threads.some((t) => t.isArchived) && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "px-4 py-2 mt-2 group-data-[collapsible=icon]:hidden", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
        Button,
        {
          variant: "ghost",
          size: "sm",
          onClick: () => setShowArchived(!showArchived),
          className: "h-6 text-xs w-full justify-start text-muted-foreground",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Filter, { className: "mr-2 h-3 w-3" }),
            showArchived ? config.labels?.hideArchived || "Hide Archived" : config.labels?.showArchived || "Show Archived"
          ]
        }
      ) }),
      Object.keys(groupedThreads).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "px-4 py-8 text-center text-muted-foreground group-data-[collapsible=icon]:hidden", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "mx-auto h-8 w-8 mb-2 flex items-center justify-center rounded-full bg-muted/50", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Plus, { className: "h-4 w-4 opacity-50" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "text-xs", children: searchQuery ? config.labels?.noThreadsFound || "No conversations found" : config.labels?.noThreadsYet || "No conversations yet" })
      ] }) : Object.entries(groupedThreads).map(([group, groupThreads]) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(SidebarGroup, { className: "mt-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarGroupLabel, { className: "group-data-[collapsible=icon]:hidden", children: group }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarGroupContent, { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarMenu, { children: groupThreads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(SidebarMenuItem, { children: [
          editingThreadId === thread.id ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "flex items-center gap-1 px-2 py-1", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
            Input,
            {
              ref: inputRef,
              value: editTitle,
              onChange: (e) => setEditTitle(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              },
              onBlur: saveEdit,
              className: "h-7 text-sm"
            }
          ) }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            SidebarMenuButton,
            {
              isActive: currentThreadId === thread.id,
              onClick: () => onSelectThread?.(thread.id),
              tooltip: thread.title,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ThreadInitialsIcon, { title: thread.title || "?" }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "flex flex-col items-start gap-0.5 flex-1 min-w-0 group-data-[collapsible=icon]:hidden", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "truncate w-full", children: thread.title || "New Chat" }) }),
                thread.isArchived && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Archive, { className: "ml-auto h-3 w-3 opacity-50 group-data-[collapsible=icon]:hidden" })
              ]
            }
          ),
          !editingThreadId && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DropdownMenu, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(SidebarMenuAction, { showOnHover: true, children: [
              /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.MoreHorizontal, {}),
              /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "sr-only", children: "More" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DropdownMenuContent, { className: "w-48", side: "right", align: "start", children: [
              /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DropdownMenuItem, { onClick: () => startEditing(thread), children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Edit2, { className: "mr-2 h-4 w-4" }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: config.labels?.renameThread || "Rename" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(DropdownMenuItem, { onClick: () => onArchiveThread?.(thread.id), children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Archive, { className: "mr-2 h-4 w-4" }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: thread.isArchived ? config.labels?.unarchiveThread || "Unarchive" : config.labels?.archiveThread || "Archive" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(DropdownMenuSeparator, {}),
              /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
                DropdownMenuItem,
                {
                  onClick: () => setDeleteThreadId(thread.id),
                  className: "text-destructive focus:text-destructive",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react7.Trash2, { className: "mr-2 h-4 w-4" }),
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: config.labels?.deleteThread || "Delete" })
                  ]
                }
              )
            ] })
          ] })
        ] }, thread.id)) }) })
      ] }, group))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      UserMenu,
      {
        user,
        config: config.userMenu,
        callbacks: userMenuCallbacks,
        currentTheme,
        showThemeOptions,
        additionalItems: userMenuAdditionalItems
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SidebarRail, {}),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AlertDialog, { open: !!deleteThreadId, onOpenChange: () => setDeleteThreadId(null), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(AlertDialogContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(AlertDialogHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AlertDialogTitle, { children: config.labels?.deleteConfirmTitle || "Delete Conversation" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AlertDialogDescription, { children: config.labels?.deleteConfirmDescription || "Are you sure you want to delete this conversation? This action cannot be undone." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(AlertDialogFooter, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AlertDialogCancel, { children: config.labels?.cancel || "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
          AlertDialogAction,
          {
            onClick: () => deleteThreadId && handleDeleteThread(deleteThreadId),
            className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            children: config.labels?.deleteThread || "Delete"
          }
        )
      ] })
    ] }) })
  ] });
};

// src/components/chat/ChatHeader.tsx
var import_react3 = __toESM(require("react"), 1);
var import_lucide_react8 = require("lucide-react");
var import_jsx_runtime17 = require("react/jsx-runtime");
var ChatHeader = ({
  config,
  currentThreadTitle,
  onSidebarToggle: _onSidebarToggle,
  onCustomComponentToggle,
  onNewThread,
  onExportData,
  onImportData,
  onClearAll,
  showCustomComponentButton,
  isMobile,
  className = ""
}) => {
  const [isDarkMode, setIsDarkMode] = import_react3.default.useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  import_react3.default.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e) => {
      const savedTheme = localStorage.getItem("theme");
      if (!savedTheme) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);
  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setIsDarkMode(!isDark);
  };
  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file && onImportData) {
        onImportData(file);
      }
    };
    input.click();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
    Card,
    {
      "data-chat-header": true,
      className: `py-0 border-b rounded-none relative z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className}`,
      style: isMobile ? { paddingTop: "env(safe-area-inset-top)" } : void 0,
      children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CardHeader, { className: "p-2", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(Tooltip, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(SidebarTrigger, { className: "-ml-1" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TooltipContent, { children: config.labels?.sidebarToggle || "Toggle Sidebar" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center gap-3 flex-1 justify-center", children: [
          config.branding?.logo || /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Avatar, { className: "h-8 w-8", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(AvatarFallback, { children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Bot, { className: "h-4 w-4" }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "text-center hidden md:block", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CardTitle, { className: "text-sm font-medium", children: config.branding?.title || "Chat Assistant" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "md:hidden text-sm font-medium truncate max-w-[150px]", children: currentThreadTitle || config.branding?.title || "Chat" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center gap-1", children: [
          showCustomComponentButton && config.customComponent && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(Tooltip, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              Button,
              {
                variant: "ghost",
                size: "icon",
                className: "h-8 w-8",
                onClick: onCustomComponentToggle,
                children: config.customComponent.icon || /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Menu, { className: "h-4 w-4" })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TooltipContent, { children: config.customComponent.label || config.labels?.customComponentToggle || "Toggle" })
          ] }),
          config.headerActions,
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(DropdownMenu, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.MoreVertical, { className: "h-4 w-4" }) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(DropdownMenuContent, { align: "end", children: [
              onNewThread && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(DropdownMenuItem, { onClick: () => onNewThread?.(), className: "font-medium text-primary", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Plus, { className: "h-4 w-4 mr-2" }),
                  config.labels?.newThread || "New Thread"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DropdownMenuSeparator, {})
              ] }),
              onExportData && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(DropdownMenuItem, { onClick: onExportData, children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Download, { className: "h-4 w-4 mr-2" }),
                config.labels?.exportData || "Export Data"
              ] }),
              onImportData && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(DropdownMenuItem, { onClick: handleImportClick, children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Upload, { className: "h-4 w-4 mr-2" }),
                config.labels?.importData || "Import Data"
              ] }),
              (onExportData || onImportData) && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DropdownMenuSeparator, {}),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DropdownMenuItem, { onClick: toggleDarkMode, children: isDarkMode ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Sun, { className: "h-4 w-4 mr-2" }),
                config.labels?.lightMode || "Light Mode"
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Moon, { className: "h-4 w-4 mr-2" }),
                config.labels?.darkMode || "Dark Mode"
              ] }) }),
              onClearAll && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DropdownMenuSeparator, {}),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
                  DropdownMenuItem,
                  {
                    onClick: onClearAll,
                    className: "text-destructive",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react8.Trash2, { className: "h-4 w-4 mr-2" }),
                      config.labels?.clearAll || "Clear All"
                    ]
                  }
                )
              ] })
            ] })
          ] })
        ] })
      ] }) })
    }
  );
};

// src/components/chat/ChatInput.tsx
var import_react5 = require("react");

// src/components/chat/UserContext.tsx
var import_react4 = require("react");
var import_jsx_runtime18 = require("react/jsx-runtime");
var Ctx = (0, import_react4.createContext)(void 0);
var ChatUserContextProvider = ({ children, initial }) => {
  const [ctx, setCtx] = (0, import_react4.useState)(() => ({
    updatedAt: Date.now(),
    ...initial ?? {}
  }));
  (0, import_react4.useEffect)(() => {
    if (!initial) return;
    setCtx((prev) => ({
      ...prev,
      ...initial,
      updatedAt: Date.now()
    }));
  }, [initial]);
  const setPartial = (0, import_react4.useCallback)((next) => {
    setCtx((prev) => {
      const partial = typeof next === "function" ? next(prev) : next;
      return { ...prev, ...partial, updatedAt: Date.now() };
    });
  }, []);
  const value = (0, import_react4.useMemo)(() => ({
    context: ctx,
    setContext: setPartial,
    resetContext: () => setCtx({ updatedAt: Date.now() })
  }), [ctx, setPartial]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Ctx.Provider, { value, children });
};
function useChatUserContext() {
  const v = (0, import_react4.useContext)(Ctx);
  if (!v) throw new Error("useChatUserContext must be used within ChatUserContextProvider");
  return v;
}

// src/components/ui/progress.tsx
var ProgressPrimitive = __toESM(require("@radix-ui/react-progress"), 1);
var import_jsx_runtime19 = require("react/jsx-runtime");
function Progress({
  className,
  value,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
    ProgressPrimitive.Root,
    {
      "data-slot": "progress",
      className: cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      ),
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
        ProgressPrimitive.Indicator,
        {
          "data-slot": "progress-indicator",
          className: "bg-primary h-full w-full flex-1 transition-all",
          style: { transform: `translateX(-${100 - (value || 0)}%)` }
        }
      )
    }
  );
}

// src/components/chat/ChatInput.tsx
var import_lucide_react9 = require("lucide-react");
var import_jsx_runtime20 = require("react/jsx-runtime");
var FileUploadItem = ({ file, progress, onCancel }) => {
  const guessTypeFromName = (name) => {
    const ext = (name || "").split(".").pop()?.toLowerCase();
    switch (ext) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "bmp":
      case "svg":
        return "image/*";
      case "mp4":
      case "mov":
      case "m4v":
      case "webm":
        return "video/*";
      case "mp3":
      case "wav":
      case "m4a":
      case "ogg":
        return "audio/*";
      default:
        return "";
    }
  };
  const getFileIcon = (type, name) => {
    const t = typeof type === "string" && type.length > 0 ? type : guessTypeFromName(name);
    if (t.startsWith("image/")) return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Image, { className: "h-4 w-4" });
    if (t.startsWith("video/")) return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Video, { className: "h-4 w-4" });
    if (t.startsWith("audio/")) return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Mic, { className: "h-4 w-4" });
    return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.FileText, { className: "h-4 w-4" });
  };
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Card, { className: "relative", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(CardContent, { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-3", children: [
    getFileIcon(file.type, file.name),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-sm font-medium truncate", children: file.name }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-xs text-muted-foreground", children: formatFileSize(file.size ?? 0) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Progress, { value: progress, className: "h-1 mt-1" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
      Button,
      {
        variant: "ghost",
        size: "icon",
        className: "h-6 w-6",
        onClick: onCancel,
        children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.X, { className: "h-3 w-3" })
      }
    )
  ] }) }) });
};
var AttachmentPreview = ({ attachment, onRemove }) => {
  const [isPlaying, setIsPlaying] = (0, import_react5.useState)(false);
  const audioRef = (0, import_react5.useRef)(null);
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  const formatDuration = (ms) => {
    if (!ms) return "";
    const seconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Card, { className: "relative group", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(CardContent, { className: "p-2", children: [
    attachment.kind === "image" && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "relative", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        "img",
        {
          src: attachment.dataUrl,
          alt: attachment.fileName || "Anexo",
          className: "w-full h-20 object-cover rounded"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Button,
        {
          variant: "destructive",
          size: "icon",
          className: "h-6 w-6",
          onClick: onRemove,
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.X, { className: "h-3 w-3" })
        }
      ) })
    ] }),
    attachment.kind === "video" && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "relative", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        "video",
        {
          src: attachment.dataUrl,
          poster: attachment.poster,
          className: "w-full h-20 object-cover rounded",
          muted: true
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Button,
        {
          variant: "destructive",
          size: "icon",
          className: "h-6 w-6",
          onClick: onRemove,
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.X, { className: "h-3 w-3" })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Badge, { className: "absolute bottom-1 right-1 text-xs", children: formatDuration(attachment.durationMs) })
    ] }),
    attachment.kind === "audio" && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2 p-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Button,
        {
          variant: "outline",
          size: "icon",
          className: "h-8 w-8",
          onClick: handlePlayPause,
          children: isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Pause, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Play, { className: "h-3 w-3" })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-xs font-medium", children: attachment.fileName || "\xC1udio" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-xs text-muted-foreground", children: formatDuration(attachment.durationMs) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        "audio",
        {
          ref: audioRef,
          src: attachment.dataUrl,
          onPlay: () => setIsPlaying(true),
          onPause: () => setIsPlaying(false),
          onEnded: () => setIsPlaying(false)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Button,
        {
          variant: "ghost",
          size: "icon",
          className: "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          onClick: onRemove,
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.X, { className: "h-3 w-3" })
        }
      )
    ] }),
    attachment.fileName && attachment.kind !== "audio" && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "truncate", children: attachment.fileName }) })
  ] }) });
};
var AudioRecorder = ({ isRecording, onStartRecording, onStopRecording, onCancel, recordingDuration, config }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  if (!isRecording) {
    return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Tooltip, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Button,
        {
          variant: "outline",
          size: "icon",
          onClick: onStartRecording,
          className: "h-10 w-10",
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Mic, { className: "h-4 w-4" })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipContent, { children: config?.labels?.recordAudioTooltip })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Card, { className: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(CardContent, { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "h-3 w-3 bg-red-500 rounded-full animate-pulse" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-sm font-medium text-red-700 dark:text-red-300", children: "Gravando" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Badge, { variant: "outline", className: "text-xs", children: formatTime(recordingDuration) }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex gap-1 ml-auto", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
        Button,
        {
          variant: "outline",
          size: "sm",
          onClick: onCancel,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.X, { className: "h-3 w-3 mr-1" }),
            "Cancelar"
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
        Button,
        {
          variant: "default",
          size: "sm",
          onClick: onStopRecording,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Square, { className: "h-3 w-3 mr-1" }),
            "Parar"
          ]
        }
      )
    ] })
  ] }) }) });
};
var ChatInput = ({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttachmentsChange,
  placeholder = "Digite sua mensagem...",
  disabled = false,
  isGenerating = false,
  onStopGeneration,
  enableFileUpload = true,
  enableAudioRecording = true,
  maxAttachments = 4,
  maxFileSize = 10 * 1024 * 1024,
  // 10MB
  acceptedFileTypes = ["image/*", "video/*", "audio/*"],
  className = "",
  config
}) => {
  const [isRecording, setIsRecording] = (0, import_react5.useState)(false);
  const { setContext } = useChatUserContext();
  const [recordingDuration, setRecordingDuration] = (0, import_react5.useState)(0);
  const [uploadProgress, setUploadProgress] = (0, import_react5.useState)(/* @__PURE__ */ new Map());
  const textareaRef = (0, import_react5.useRef)(null);
  const fileInputRef = (0, import_react5.useRef)(null);
  const mediaRecorderRef = (0, import_react5.useRef)(null);
  const recordingStartTime = (0, import_react5.useRef)(0);
  const recordingInterval = (0, import_react5.useRef)(null);
  const mediaStreamRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() && attachments.length === 0 || disabled || isGenerating) return;
    onSubmit(value.trim(), attachments);
    onChange("");
    onAttachmentsChange([]);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && window.innerWidth > 768) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  const processFile = async (file) => {
    if (file.size > maxFileSize) {
      alert(`Arquivo muito grande. M\xE1ximo permitido: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return null;
    }
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setUploadProgress((prev) => new Map(prev.set(fileId, {
      fileName: file.name,
      progress: 0,
      status: "uploading"
    })));
    try {
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadProgress((prev) => new Map(prev.set(fileId, {
          fileName: file.name,
          progress,
          status: "uploading"
        })));
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setUploadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      const attachment = {
        kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image",
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
        size: file.size
      };
      if (attachment.kind === "video") {
        try {
          const video = document.createElement("video");
          video.src = dataUrl;
          await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
          });
          attachment.durationMs = video.duration * 1e3;
        } catch (error) {
          console.warn("Could not get video duration:", error);
        }
      }
      if (attachment.kind === "image") {
        setContext({ lastReferenceImage: { dataUrl: attachment.dataUrl, mimeType: attachment.mimeType, addedAt: Date.now() } });
      }
      return attachment;
    } catch (error) {
      console.error("Error processing file:", error);
      setUploadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      alert("Erro ao processar arquivo");
      return null;
    }
  };
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files) return;
    const remainingSlots = maxAttachments - attachments.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    for (const file of filesToProcess) {
      const attachment = await processFile(file);
      if (attachment) {
        onAttachmentsChange([...attachments, attachment]);
      }
    }
    e.target.value = "";
  };
  const handleDrop = (0, import_react5.useCallback)(async (e) => {
    e.preventDefault();
    if (!enableFileUpload) return;
    const files = Array.from(e.dataTransfer.files);
    const remainingSlots = maxAttachments - attachments.length;
    const filesToProcess = files.slice(0, remainingSlots);
    for (const file of filesToProcess) {
      const attachment = await processFile(file);
      if (attachment) {
        onAttachmentsChange([...attachments, attachment]);
      }
    }
  }, [attachments, enableFileUpload, maxAttachments, onAttachmentsChange]);
  const handleDragOver = (0, import_react5.useCallback)((e) => {
    e.preventDefault();
  }, []);
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const attachment = {
          kind: "audio",
          dataUrl,
          mimeType: blob.type,
          durationMs: recordingDuration * 1e3,
          fileName: `audio_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}.webm`,
          size: blob.size
        };
        onAttachmentsChange([...attachments, attachment]);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      recordingStartTime.current = Date.now();
      setRecordingDuration(0);
      setIsRecording(true);
      mediaRecorder.start();
      recordingInterval.current = setInterval(() => {
        const duration = Math.floor((Date.now() - recordingStartTime.current) / 1e3);
        setRecordingDuration(duration);
      }, 1e3);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("N\xE3o foi poss\xEDvel acessar o microfone");
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };
  const removeAttachment = (index) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };
  const canAddMoreAttachments = attachments.length < maxAttachments;
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: `border-t py-0 bg-transparent ${className}`, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "px-0 md:p-2 pb-1 space-y-4 bg-transparent", children: [
    uploadProgress.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "space-y-2", children: Array.from(uploadProgress.entries()).map(([id, progress]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
      FileUploadItem,
      {
        file: { name: progress.fileName },
        progress: progress.progress,
        onCancel: () => {
          setUploadProgress((prev) => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        }
      },
      id
    )) }),
    isRecording && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
      AudioRecorder,
      {
        isRecording,
        onStartRecording: startRecording,
        onStopRecording: stopRecording,
        onCancel: cancelRecording,
        recordingDuration,
        config
      }
    ),
    attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "grid grid-cols-4 gap-2", children: attachments.map((attachment, index) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
      AttachmentPreview,
      {
        attachment,
        onRemove: () => removeAttachment(index)
      },
      index
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("form", { onSubmit: handleSubmit, className: "mb-1 flex justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
      "div",
      {
        className: "flex  items-end gap-2 p-3 border rounded-lg bg-background w-full md:min-w-3xl max-w-3xl",
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        children: [
          enableFileUpload && canAddMoreAttachments && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
              "input",
              {
                ref: fileInputRef,
                type: "file",
                multiple: true,
                accept: acceptedFileTypes.join(","),
                onChange: handleFileSelect,
                className: "hidden"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Tooltip, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  size: "icon",
                  className: "h-10 w-10",
                  onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  },
                  disabled,
                  children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Paperclip, { className: "h-4 w-4" })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipContent, { children: config?.labels?.attachFileTooltip })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex-1", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            Textarea,
            {
              ref: textareaRef,
              value,
              onChange: (e) => onChange(e.target.value),
              onKeyDown: handleKeyDown,
              placeholder,
              disabled: disabled || isGenerating,
              className: "max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
              rows: 1
            }
          ) }),
          enableAudioRecording && !isRecording && canAddMoreAttachments && !value.trim() && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            AudioRecorder,
            {
              isRecording,
              onStartRecording: startRecording,
              onStopRecording: stopRecording,
              onCancel: cancelRecording,
              recordingDuration,
              config
            }
          ),
          isGenerating ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Tooltip, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "icon",
                className: "h-10 w-10",
                onClick: onStopGeneration,
                children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Square, { className: "h-4 w-4" })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipContent, { children: config?.labels?.stopGenerationTooltip })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Tooltip, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
              Button,
              {
                type: "submit",
                size: "icon",
                className: "h-10 w-10",
                disabled: disabled || !value.trim() && attachments.length === 0,
                children: disabled ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react9.Send, { className: "h-4 w-4" })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TooltipContent, { children: config?.labels?.sendMessageTooltip })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "text-[10px] text-muted-foreground text-center", children: [
      window.innerWidth > 768 ? config?.labels?.inputHelpText : "",
      attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        " \u2022 ",
        attachments.length,
        "/",
        maxAttachments,
        " anexos"
      ] }),
      config?.labels?.footerLabel && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        " \u2022 ",
        config.labels.footerLabel
      ] })
    ] })
  ] }) }) });
};

// src/components/chat/UserProfile.tsx
var import_react6 = require("react");

// src/components/ui/scroll-area.tsx
var React8 = __toESM(require("react"), 1);
var ScrollAreaPrimitive = __toESM(require("@radix-ui/react-scroll-area"), 1);
var import_jsx_runtime21 = require("react/jsx-runtime");
var ScrollArea = React8.forwardRef(({ className, children, viewportClassName, onScroll, onScrollCapture, ...props }, ref) => {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
    ScrollAreaPrimitive.Root,
    {
      "data-slot": "scroll-area",
      className: cn("relative", className),
      ...props,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
          ScrollAreaPrimitive.Viewport,
          {
            ref,
            "data-slot": "scroll-area-viewport",
            className: cn(
              "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
              viewportClassName
            ),
            onScroll,
            onScrollCapture,
            children
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(ScrollBar, {}),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(ScrollAreaPrimitive.Corner, {})
      ]
    }
  );
});
ScrollArea.displayName = "ScrollArea";
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
    ScrollAreaPrimitive.ScrollAreaScrollbar,
    {
      "data-slot": "scroll-area-scrollbar",
      orientation,
      className: cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        className
      ),
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        ScrollAreaPrimitive.ScrollAreaThumb,
        {
          "data-slot": "scroll-area-thumb",
          className: "bg-border relative flex-1 rounded-full"
        }
      )
    }
  );
}

// src/components/chat/UserProfile.tsx
var import_lucide_react10 = require("lucide-react");
var import_jsx_runtime22 = require("react/jsx-runtime");
var getInitials2 = (name, email) => {
  if (name) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
};
var getFieldIcon = (type, key) => {
  const iconClass = "h-4 w-4 text-muted-foreground";
  switch (type) {
    case "email":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Mail, { className: iconClass });
    case "phone":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Phone, { className: iconClass });
    case "url":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Globe, { className: iconClass });
    case "date":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Calendar, { className: iconClass });
  }
  const lowerKey = key?.toLowerCase() || "";
  if (lowerKey.includes("follower")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Users, { className: iconClass });
  if (lowerKey.includes("following")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.UserPlus, { className: iconClass });
  if (lowerKey.includes("post") || lowerKey.includes("publication")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Image, { className: iconClass });
  if (lowerKey.includes("verified") || lowerKey.includes("badge")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.BadgeCheck, { className: iconClass });
  if (lowerKey.includes("bio")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.FileText, { className: iconClass });
  if (lowerKey.includes("email")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Mail, { className: iconClass });
  if (lowerKey.includes("phone") || lowerKey.includes("tel")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Phone, { className: iconClass });
  if (lowerKey.includes("location") || lowerKey.includes("address") || lowerKey.includes("city")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.MapPin, { className: iconClass });
  if (lowerKey.includes("company") || lowerKey.includes("org")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Building, { className: iconClass });
  if (lowerKey.includes("job") || lowerKey.includes("role") || lowerKey.includes("title") || lowerKey.includes("position")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Briefcase, { className: iconClass });
  if (lowerKey.includes("website") || lowerKey.includes("url") || lowerKey.includes("link")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Globe, { className: iconClass });
  if (lowerKey.includes("username") || lowerKey.includes("handle")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.AtSign, { className: iconClass });
  if (lowerKey.includes("date") || lowerKey.includes("birthday") || lowerKey.includes("joined")) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Calendar, { className: iconClass });
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.User, { className: iconClass });
};
var formatValue = (value, type, key) => {
  if (value === null || value === void 0) return "-";
  if (typeof value === "boolean") {
    if (key?.toLowerCase().includes("verified")) {
      return value ? "Verified \u2713" : "Not verified";
    }
    return value ? "Yes" : "No";
  }
  if (type === "date" && (typeof value === "string" || typeof value === "number")) {
    try {
      return new Date(value).toLocaleDateString("en-US");
    } catch {
      return String(value);
    }
  }
  return String(value);
};
var normalizeCustomFields = (fields) => {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields;
  }
  return Object.entries(fields).filter(([_, value]) => value !== null && value !== void 0 && value !== "").map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim(),
    value
  }));
};
var getMemoryCategoryIcon = (category) => {
  const iconClass = "h-4 w-4 text-muted-foreground";
  switch (category) {
    case "preference":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Heart, { className: iconClass });
    case "fact":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Info, { className: iconClass });
    case "goal":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Target, { className: iconClass });
    case "context":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Lightbulb, { className: iconClass });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Brain, { className: iconClass });
  }
};
var getMemoryCategoryLabel = (category) => {
  switch (category) {
    case "preference":
      return "Prefer\xEAncia";
    case "fact":
      return "Fato";
    case "goal":
      return "Meta";
    case "context":
      return "Contexto";
    default:
      return "Outro";
  }
};
var UserProfile = ({
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
  className
}) => {
  const [newMemoryContent, setNewMemoryContent] = (0, import_react6.useState)("");
  const [isAddingMemory, setIsAddingMemory] = (0, import_react6.useState)(false);
  const [editingMemoryId, setEditingMemoryId] = (0, import_react6.useState)(null);
  const [editingMemoryContent, setEditingMemoryContent] = (0, import_react6.useState)("");
  const handleAddMemory = () => {
    if (newMemoryContent.trim() && onAddMemory) {
      onAddMemory(newMemoryContent.trim(), "other");
      setNewMemoryContent("");
      setIsAddingMemory(false);
    }
  };
  const handleStartEdit = (memory) => {
    setEditingMemoryId(memory.id);
    setEditingMemoryContent(memory.content);
  };
  const handleSaveEdit = () => {
    if (editingMemoryId && editingMemoryContent.trim() && onUpdateMemory) {
      onUpdateMemory(editingMemoryId, editingMemoryContent.trim());
      setEditingMemoryId(null);
      setEditingMemoryContent("");
    }
  };
  const handleCancelEdit = () => {
    setEditingMemoryId(null);
    setEditingMemoryContent("");
  };
  const labels = {
    title: config?.labels?.title || "Profile",
    basicInfo: config?.labels?.basicInfo || "Account",
    customFields: config?.labels?.customFields || "Details",
    memories: config?.labels?.memories || "Memories",
    addMemory: config?.labels?.addMemory || "Add memory",
    noMemories: config?.labels?.noMemories || "No memories yet",
    close: config?.labels?.close || "Close",
    noCustomFields: config?.labels?.noCustomFields || "No additional information"
  };
  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = getInitials2(user?.name, user?.email);
  const normalizedFields = normalizeCustomFields(customFields);
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Sheet, { open: isOpen, onOpenChange: (open) => !open && onClose(), children: /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
    SheetContent,
    {
      side: "right",
      className: cn("w-full sm:max-w-md p-0 flex flex-col h-full overflow-hidden", className),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(SheetHeader, { className: "px-6 py-4 border-b shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(SheetTitle, { children: labels.title }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(ScrollArea, { className: "flex-1 min-h-0", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "p-6 space-y-6", children: [
          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex flex-col items-center text-center space-y-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(Avatar, { className: "h-24 w-24 shrink-0", children: [
              user?.avatar && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(AvatarImage, { src: user.avatar, alt: displayName }),
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(AvatarFallback, { className: "text-2xl bg-primary/10 text-primary", children: initials })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "w-full px-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("h2", { className: "text-xl font-semibold break-words", children: displayName }),
              user?.email && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm text-muted-foreground break-words", children: user.email })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Separator, {}),
          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "space-y-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("h3", { className: "text-sm font-medium text-muted-foreground uppercase tracking-wider", children: labels.basicInfo }),
            /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "space-y-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex items-start gap-3 p-3 rounded-lg bg-muted/50", children: [
                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.User, { className: "h-4 w-4 text-muted-foreground mt-0.5 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-xs text-muted-foreground", children: "Name" }),
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm font-medium break-words", children: displayName })
                ] })
              ] }),
              user?.email && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex items-start gap-3 p-3 rounded-lg bg-muted/50", children: [
                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.AtSign, { className: "h-4 w-4 text-muted-foreground mt-0.5 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-xs text-muted-foreground", children: "Handle" }),
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm font-medium break-words", children: user.email })
                ] })
              ] }),
              user?.id && user.id !== user?.name && user.id !== user?.email && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex items-start gap-3 p-3 rounded-lg bg-muted/50", children: [
                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.User, { className: "h-4 w-4 text-muted-foreground mt-0.5 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-xs text-muted-foreground", children: "ID" }),
                  /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm font-medium break-words", children: user.id })
                ] })
              ] })
            ] })
          ] }),
          normalizedFields.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_jsx_runtime22.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Separator, {}),
            /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "space-y-3", children: [
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("h3", { className: "text-sm font-medium text-muted-foreground uppercase tracking-wider", children: labels.customFields }),
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "space-y-2", children: normalizedFields.map((field) => {
                const isBioField = field.key.toLowerCase().includes("bio");
                return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
                  "div",
                  {
                    className: "flex items-start gap-3 p-3 rounded-lg bg-muted/50",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "mt-0.5 shrink-0", children: field.icon || getFieldIcon(field.type, field.key) }),
                      /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex-1 min-w-0", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-xs text-muted-foreground", children: field.label }),
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: cn(
                          "text-sm font-medium",
                          isBioField ? "whitespace-pre-wrap break-words" : "break-words"
                        ), children: formatValue(field.value, field.type, field.key) })
                      ] })
                    ]
                  },
                  field.key
                );
              }) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Separator, {}),
          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "space-y-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("h3", { className: "text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Brain, { className: "h-4 w-4" }),
                labels.memories
              ] }),
              onAddMemory && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
                Button,
                {
                  variant: "ghost",
                  size: "sm",
                  className: "h-7 px-2",
                  onClick: () => setIsAddingMemory(true),
                  children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Plus, { className: "h-4 w-4" })
                }
              )
            ] }),
            isAddingMemory && onAddMemory && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
                Input,
                {
                  value: newMemoryContent,
                  onChange: (e) => setNewMemoryContent(e.target.value),
                  placeholder: "O que devo lembrar?",
                  className: "flex-1 h-9",
                  onKeyDown: (e) => {
                    if (e.key === "Enter") handleAddMemory();
                    if (e.key === "Escape") {
                      setIsAddingMemory(false);
                      setNewMemoryContent("");
                    }
                  },
                  autoFocus: true
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Button, { size: "sm", onClick: handleAddMemory, disabled: !newMemoryContent.trim(), children: "Salvar" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "space-y-2", children: memories.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm text-muted-foreground text-center py-4", children: labels.noMemories }) : memories.map((memory) => {
              const isEditing = editingMemoryId === memory.id;
              return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
                "div",
                {
                  className: "flex items-start gap-3 p-3 rounded-lg bg-muted/50 group",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "mt-0.5 shrink-0", children: memory.source === "agent" ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Bot, { className: "h-4 w-4 text-primary" }) : getMemoryCategoryIcon(memory.category) }),
                    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex-1 min-w-0", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex items-center gap-2 mb-0.5", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "text-xs text-muted-foreground", children: getMemoryCategoryLabel(memory.category) }),
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "text-xs text-muted-foreground", children: "\u2022" }),
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "text-xs text-muted-foreground", children: memory.source === "agent" ? "IA" : "Voc\xEA" })
                      ] }),
                      isEditing ? /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "space-y-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
                          Textarea,
                          {
                            value: editingMemoryContent,
                            onChange: (e) => setEditingMemoryContent(e.target.value),
                            className: "min-h-[60px] text-sm resize-none",
                            autoFocus: true,
                            onKeyDown: (e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                handleSaveEdit();
                              }
                              if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex gap-1 justify-end", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
                            Button,
                            {
                              variant: "ghost",
                              size: "sm",
                              className: "h-7 px-2",
                              onClick: handleCancelEdit,
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.X, { className: "h-3.5 w-3.5 mr-1" }),
                                "Cancelar"
                              ]
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
                            Button,
                            {
                              size: "sm",
                              className: "h-7 px-2",
                              onClick: handleSaveEdit,
                              disabled: !editingMemoryContent.trim(),
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Check, { className: "h-3.5 w-3.5 mr-1" }),
                                "Salvar"
                              ]
                            }
                          )
                        ] })
                      ] }) : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: "text-sm break-words", children: memory.content })
                    ] }),
                    !isEditing && (onUpdateMemory || onDeleteMemory) && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0", children: [
                      onUpdateMemory && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
                        Button,
                        {
                          variant: "ghost",
                          size: "icon",
                          className: "h-7 w-7",
                          onClick: () => handleStartEdit(memory),
                          children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Pencil, { className: "h-3.5 w-3.5 text-muted-foreground" })
                        }
                      ),
                      onDeleteMemory && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
                        Button,
                        {
                          variant: "ghost",
                          size: "icon",
                          className: "h-7 w-7",
                          onClick: () => onDeleteMemory(memory.id),
                          children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react10.Trash2, { className: "h-3.5 w-3.5 text-destructive" })
                        }
                      )
                    ] })
                  ]
                },
                memory.id
              );
            }) })
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "p-4 border-t space-y-2 shrink-0", children: [
          onEditProfile && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
            Button,
            {
              variant: "outline",
              className: "w-full",
              onClick: onEditProfile,
              children: "Edit Profile"
            }
          ),
          onLogout && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
            Button,
            {
              variant: "destructive",
              className: "w-full",
              onClick: onLogout,
              children: "Log out"
            }
          )
        ] })
      ]
    }
  ) });
};

// src/components/chat/ChatUI.tsx
var import_lucide_react11 = require("lucide-react");
var import_jsx_runtime23 = require("react/jsx-runtime");
var ChatUI = ({
  messages = [],
  threads = [],
  currentThreadId = null,
  config: userConfig,
  sidebar: _sidebar,
  isGenerating = false,
  callbacks = {},
  user,
  assistant,
  suggestions = [],
  className = "",
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory
}) => {
  const config = mergeConfig(defaultChatConfig, userConfig);
  const [isMobile, setIsMobile] = (0, import_react7.useState)(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = (0, import_react7.useState)(false);
  let userContext;
  try {
    const contextValue = useChatUserContext();
    userContext = contextValue?.context;
  } catch {
    userContext = void 0;
  }
  const getInitialSidebarState = () => {
    if (typeof globalThis.innerWidth === "number") {
      return globalThis.innerWidth >= 1024;
    }
    return false;
  };
  const [state, setState] = (0, import_react7.useState)({
    input: "",
    attachments: [],
    isRecording: false,
    selectedThreadId: currentThreadId,
    isAtBottom: true,
    showSidebar: getInitialSidebarState(),
    // Open by default on desktop
    showThreads: false,
    // No longer used for main sidebar
    editingMessageId: null,
    isSidebarCollapsed: false
    // No longer used for main sidebar
  });
  (0, import_react7.useEffect)(() => {
    if (currentThreadId !== state.selectedThreadId) {
      setState((prev) => ({ ...prev, selectedThreadId: currentThreadId }));
    }
  }, [currentThreadId]);
  const messagesEndRef = (0, import_react7.useRef)(null);
  const scrollAreaRef = (0, import_react7.useRef)(null);
  const [isCustomMounted, setIsCustomMounted] = (0, import_react7.useState)(false);
  const [isCustomVisible, setIsCustomVisible] = (0, import_react7.useState)(false);
  const createStateCallback = (0, import_react7.useCallback)(
    (setter) => ({
      setState: (newState) => setter?.(newState),
      getState: () => state
    }),
    [state]
  );
  (0, import_react7.useEffect)(() => {
    const checkMobile = () => {
      setIsMobile(globalThis.innerWidth < 1024);
    };
    checkMobile();
    globalThis.addEventListener("resize", checkMobile);
    return () => globalThis.removeEventListener("resize", checkMobile);
  }, []);
  (0, import_react7.useEffect)(() => {
    if (!isMobile || !config.customComponent?.component) return;
    if (state.showSidebar) {
      setIsCustomMounted(true);
      requestAnimationFrame(() => setIsCustomVisible(true));
    } else {
      setIsCustomVisible(false);
      const t = setTimeout(() => setIsCustomMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [state.showSidebar, isMobile, config.customComponent]);
  (0, import_react7.useEffect)(() => {
    if (!state.isAtBottom) return;
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    const target = viewport.scrollHeight;
    try {
      viewport.scrollTo({ top: target, behavior: "smooth" });
    } catch {
      viewport.scrollTop = target;
    }
  }, [messages, state.isAtBottom]);
  const handleScroll = (0, import_react7.useCallback)((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setState((prev) => ({ ...prev, isAtBottom }));
  }, []);
  const handleSendMessage = (0, import_react7.useCallback)((content, attachments = []) => {
    if (!content.trim() && attachments.length === 0) return;
    callbacks.onSendMessage?.(content, attachments, createStateCallback());
    setState((prev) => ({
      ...prev,
      input: "",
      attachments: []
    }));
  }, [callbacks, createStateCallback]);
  const handleMessageAction = (0, import_react7.useCallback)((event) => {
    const { action, messageId, content } = event;
    switch (action) {
      case "copy":
        callbacks.onCopyMessage?.(messageId, content || "", createStateCallback());
        break;
      case "edit":
        if (content) {
          callbacks.onEditMessage?.(messageId, content, createStateCallback());
        }
        break;
      case "regenerate":
        callbacks.onRegenerateMessage?.(messageId, createStateCallback());
        break;
      case "delete":
        callbacks.onDeleteMessage?.(messageId, createStateCallback());
        break;
    }
  }, [callbacks, createStateCallback]);
  const handleCreateThread = (0, import_react7.useCallback)((title) => {
    callbacks.onCreateThread?.(title, createStateCallback(setState));
  }, [callbacks, createStateCallback]);
  const handleSelectThread = (0, import_react7.useCallback)((threadId) => {
    callbacks.onSelectThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);
  const handleRenameThread = (0, import_react7.useCallback)((threadId, newTitle) => {
    callbacks.onRenameThread?.(threadId, newTitle, createStateCallback());
  }, [callbacks, createStateCallback]);
  const handleDeleteThread = (0, import_react7.useCallback)((threadId) => {
    callbacks.onDeleteThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);
  const handleArchiveThread = (0, import_react7.useCallback)((threadId) => {
    callbacks.onArchiveThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);
  const closeSidebar = (0, import_react7.useCallback)(() => {
    setState((prev) => ({ ...prev, showSidebar: false }));
  }, []);
  const renderCustomComponent = (0, import_react7.useCallback)(() => {
    const component = config?.customComponent?.component;
    if (!component) return null;
    if (typeof component === "function") {
      return component({ onClose: closeSidebar, isMobile });
    }
    return component;
  }, [config?.customComponent?.component, closeSidebar, isMobile]);
  const renderSuggestions = () => {
    if (messages.length > 0 || !suggestions.length) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "text-center py-8", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_lucide_react11.Sparkles, { className: "w-8 h-8 text-primary" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("h3", { className: "text-lg font-semibold mb-2", children: config.branding.title }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: "text-muted-foreground mb-6", children: config.branding.subtitle }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto", children: suggestions.map((suggestion, index) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        Card,
        {
          className: "cursor-pointer hover:bg-muted/50 transition-colors",
          onClick: () => handleSendMessage(suggestion),
          children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(CardContent, { className: "p-4 text-left", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: "text-sm", children: suggestion }) })
        },
        index
      )) })
    ] });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(TooltipProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(SidebarProvider, { defaultOpen: true, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `flex h-[100svh] md:h-screen bg-background w-full overflow-hidden ${className}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
      Sidebar2,
      {
        threads,
        currentThreadId: state.selectedThreadId,
        config,
        onCreateThread: handleCreateThread,
        onSelectThread: handleSelectThread,
        onRenameThread: handleRenameThread,
        onDeleteThread: handleDeleteThread,
        onArchiveThread: handleArchiveThread,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        } : null,
        userMenuCallbacks: {
          onViewProfile: () => {
            setIsUserProfileOpen(true);
            callbacks.onViewProfile?.();
          },
          onOpenSettings: callbacks.onOpenSettings,
          onThemeChange: callbacks.onThemeChange,
          onLogout: callbacks.onLogout
        },
        currentTheme: config.ui.theme === "auto" ? "system" : config.ui.theme,
        showThemeOptions: !!callbacks.onThemeChange
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(SidebarInset, { children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex flex-col h-full min-h-0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        ChatHeader,
        {
          config,
          currentThreadTitle: threads.find((t) => t.id === state.selectedThreadId)?.title,
          isMobile,
          onCustomComponentToggle: () => setState((prev) => ({ ...prev, showSidebar: !prev.showSidebar })),
          onNewThread: handleCreateThread,
          showCustomComponentButton: !!config?.customComponent?.component
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex flex-1 flex-row min-h-0 overflow-hidden", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex-1 flex flex-col min-h-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
            ScrollArea,
            {
              ref: scrollAreaRef,
              className: "flex-1 min-h-0",
              viewportClassName: "p-4 overscroll-contain",
              onScrollCapture: handleScroll,
              children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "max-w-4xl mx-auto space-y-4 pb-4", children: [
                renderSuggestions(),
                messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
                  Message,
                  {
                    message,
                    userAvatar: user?.avatar,
                    userName: user?.name,
                    assistantAvatar: assistant?.avatar,
                    assistantName: assistant?.name,
                    showTimestamp: config.ui.showTimestamps,
                    showAvatar: config.ui.showAvatars,
                    enableCopy: config.features.enableMessageCopy,
                    enableEdit: config.features.enableMessageEditing,
                    enableRegenerate: config.features.enableRegeneration,
                    enableToolCallsDisplay: config.features.enableToolCallsDisplay,
                    compactMode: config.ui.compactMode,
                    onAction: handleMessageAction,
                    toolUsedLabel: config.labels.toolUsed,
                    thinkingLabel: config.labels.thinking
                  },
                  message.id
                )),
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { ref: messagesEndRef })
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "bg-background pb-[env(safe-area-inset-bottom)]", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
            ChatInput,
            {
              value: state.input,
              onChange: (value) => setState((prev) => ({ ...prev, input: value })),
              onSubmit: handleSendMessage,
              attachments: state.attachments,
              onAttachmentsChange: (attachments) => setState((prev) => ({ ...prev, attachments })),
              placeholder: config.labels.inputPlaceholder,
              disabled: false,
              isGenerating,
              onStopGeneration: callbacks.onStopGeneration,
              enableFileUpload: config.features.enableFileUpload,
              enableAudioRecording: config.features.enableAudioRecording,
              maxAttachments: config.features.maxAttachments,
              maxFileSize: config.features.maxFileSize,
              config
            }
          ) })
        ] }),
        config?.customComponent?.component && !isMobile && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
          "div",
          {
            className: `h-full transition-all duration-300 ease-in-out overflow-hidden ${state.showSidebar ? "w-80" : "w-0"}`,
            children: state.showSidebar && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "flex flex-col h-full border-l bg-background animate-in slide-in-from-right-4 duration-300 w-80", children: renderCustomComponent() })
          }
        )
      ] })
    ] }) }),
    isCustomMounted && config.customComponent?.component && isMobile && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "fixed inset-0 z-50", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        "div",
        {
          className: `absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200 ease-out ${isCustomVisible ? "opacity-100" : "opacity-0"}`,
          style: { willChange: "opacity" },
          onClick: closeSidebar
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        "div",
        {
          className: `absolute top-0 right-0 h-full w-full bg-background transform-gpu transition-transform duration-200 ease-out ${isCustomVisible ? "translate-x-0" : "translate-x-full"}`,
          style: { willChange: "transform" },
          children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "h-full flex flex-col", children: renderCustomComponent() })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
      UserProfile,
      {
        isOpen: isUserProfileOpen,
        onClose: () => setIsUserProfileOpen(false),
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        } : null,
        customFields: userContext?.customFields,
        memories: userContext?.memories?.items,
        onLogout: callbacks.onLogout,
        onAddMemory,
        onUpdateMemory,
        onDeleteMemory
      }
    )
  ] }) }) });
};

// src/components/chat/ThreadManager.tsx
var import_react8 = require("react");
var import_lucide_react12 = require("lucide-react");
var import_jsx_runtime24 = require("react/jsx-runtime");
var ThreadItem = ({ thread, isActive, config, onSelect, onRename, onDelete, onArchive }) => {
  const [isEditing, setIsEditing] = (0, import_react8.useState)(false);
  const [editTitle, setEditTitle] = (0, import_react8.useState)(thread.title);
  const inputRef = (0, import_react8.useRef)(null);
  (0, import_react8.useEffect)(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  const handleSaveEdit = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== thread.title) {
      onRename(trimmedTitle);
    }
    setIsEditing(false);
  };
  const handleCancelEdit = () => {
    setEditTitle(thread.title);
    setIsEditing(false);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Card, { className: `cursor-pointer transition-all duration-200 hover:shadow-md py-0 ${isActive ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"}`, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(CardContent, { className: "p-3 max-w-sm", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-start justify-between gap-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "flex-1 min-w-0", onClick: onSelect, children: isEditing ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
        Input,
        {
          ref: inputRef,
          value: editTitle,
          onChange: (e) => setEditTitle(e.target.value),
          onKeyDown: handleKeyDown,
          onBlur: handleSaveEdit,
          className: "h-8 text-sm",
          placeholder: config?.labels?.threadNamePlaceholder || "Conversation name"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { size: "sm", variant: "ghost", onClick: handleSaveEdit, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Check, { className: "h-3 w-3" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { size: "sm", variant: "ghost", onClick: handleCancelEdit, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.X, { className: "h-3 w-3" }) })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_jsx_runtime24.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("h4", { className: "font-medium text-sm truncate mb-1", children: thread.title }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Hash, { className: "h-3 w-3" }),
          thread.messageCount,
          " msgs"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Separator, { orientation: "vertical", className: "h-3" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Calendar, { className: "h-3 w-3" }),
          formatDate(thread.updatedAt, config?.labels)
        ] }),
        thread.isArchived && /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_jsx_runtime24.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Separator, { orientation: "vertical", className: "h-3" }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(Badge, { variant: "secondary", className: "text-xs", children: [
            /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Archive, { className: "h-2 w-2 mr-1" }),
            config?.labels?.archiveThread || "Archived"
          ] })
        ] })
      ] })
    ] }) }),
    !isEditing && /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DropdownMenu, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { variant: "ghost", size: "icon", className: "h-6 w-6 m-auto", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.MoreVertical, { className: "h-3 w-3" }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DropdownMenuContent, { align: "end", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DropdownMenuItem, { onClick: () => setIsEditing(true), children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Edit2, { className: "h-4 w-4 mr-2" }),
          config?.labels?.renameThread || "Rename"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DropdownMenuItem, { onClick: onArchive, children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Archive, { className: "h-4 w-4 mr-2" }),
          thread.isArchived ? config?.labels?.unarchiveThread || "Unarchive" : config?.labels?.archiveThread || "Archive"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(DropdownMenuSeparator, {}),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DropdownMenuItem, { onClick: onDelete, className: "text-destructive", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Trash2, { className: "h-4 w-4 mr-2" }),
          config?.labels?.deleteThread || "Delete"
        ] })
      ] })
    ] })
  ] }) }) });
};
var CreateThreadDialog2 = ({ onCreateThread, config }) => {
  const [title, setTitle] = (0, import_react8.useState)("");
  const [isOpen, setIsOpen] = (0, import_react8.useState)(false);
  const handleCreate = () => {
    onCreateThread(title.trim() || void 0);
    setTitle("");
    setIsOpen(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(DialogTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(Button, { variant: "outline", className: "w-full", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Plus, { className: "h-4 w-4 mr-2" }),
      config?.labels?.createNewThread || "New Conversation"
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DialogContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DialogHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(DialogTitle, { children: config?.labels?.createNewThread || "Create New Conversation" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(DialogDescription, { children: "Give your new conversation a name or leave blank to auto-generate one." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
        Input,
        {
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: config?.labels?.threadNamePlaceholder || "Conversation name (optional)",
          onKeyDown: (e) => e.key === "Enter" && handleCreate(),
          autoFocus: true
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(DialogFooter, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { variant: "outline", onClick: () => setIsOpen(false), children: config?.labels?.cancel || "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { onClick: handleCreate, children: config?.labels?.create || "Create" })
      ] })
    ] })
  ] });
};
var ThreadManager = ({
  threads,
  currentThreadId,
  config,
  onCreateThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  isOpen = false,
  onClose,
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = (0, import_react8.useState)("");
  const [showArchived, setShowArchived] = (0, import_react8.useState)(false);
  const [deleteThreadId, setDeleteThreadId] = (0, import_react8.useState)(null);
  const filteredThreads = threads.filter((thread) => {
    const title = (thread.title ?? "").toString();
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchiveFilter = showArchived || !thread.isArchived;
    return matchesSearch && matchesArchiveFilter;
  });
  const groupedThreads = filteredThreads.reduce((groups, thread) => {
    const date = new Date(thread.updatedAt);
    const today = /* @__PURE__ */ new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1e3);
    let groupKey;
    if (date.toDateString() === today.toDateString()) {
      groupKey = config?.labels?.today || "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = config?.labels?.yesterday || "Yesterday";
    } else {
      groupKey = date.toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long"
      });
    }
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(thread);
    return groups;
  }, {});
  const handleDeleteThread = (threadId) => {
    onDeleteThread?.(threadId);
    setDeleteThreadId(null);
  };
  if (!isOpen) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(TooltipProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `fixed inset-0 z-50 bg-background/80 backdrop-blur-sm ${className}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "fixed left-0 top-0 h-full w-full max-w-md border-r bg-background shadow-lg", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(Card, { className: "h-full border-0 rounded-none", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(CardHeader, { className: "border-b", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(CardTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.MessageSquare, { className: "h-5 w-5" }),
            config?.labels?.newChat || "Conversations"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Button, { variant: "ghost", size: "icon", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.X, { className: "h-4 w-4" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "space-y-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "relative", children: [
            /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
            /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
              Input,
              {
                placeholder: config?.labels?.search || "Search conversations...",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                className: "pl-9"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
              Button,
              {
                variant: "outline",
                size: "sm",
                onClick: () => setShowArchived(!showArchived),
                className: "text-xs",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.Filter, { className: "h-3 w-3 mr-1" }),
                  showArchived ? config?.labels?.hideArchived || "Hide Archived" : config?.labels?.showArchived || "Show Archived"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(Badge, { variant: "secondary", className: "text-xs", children: [
              filteredThreads.length,
              " / ",
              threads.length
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(CardContent, { className: "p-0 flex-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "p-4", children: onCreateThread && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(CreateThreadDialog2, { onCreateThread, config }) }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(ScrollArea, { className: "h-[calc(100vh-280px)]", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "px-4 pb-4 space-y-4", children: Object.keys(groupedThreads).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "text-center py-8 text-muted-foreground", children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react12.MessageSquare, { className: "h-12 w-12 mx-auto mb-3 opacity-50" }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("p", { className: "text-sm", children: searchQuery ? config?.labels?.noThreadsFound || "No conversations found" : config?.labels?.noThreadsYet || "No conversations yet" })
        ] }) : Object.entries(groupedThreads).map(([group, groupThreads]) => /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("h3", { className: "text-sm font-medium text-muted-foreground mb-2 px-2", children: group }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "space-y-2", children: groupThreads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
            ThreadItem,
            {
              thread,
              isActive: currentThreadId === thread.id,
              config,
              onSelect: () => onSelectThread?.(thread.id),
              onRename: (newTitle) => onRenameThread?.(thread.id, newTitle),
              onDelete: () => setDeleteThreadId(thread.id),
              onArchive: () => onArchiveThread?.(thread.id)
            },
            thread.id
          )) })
        ] }, group)) }) })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(AlertDialog, { open: !!deleteThreadId, onOpenChange: () => setDeleteThreadId(null), children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(AlertDialogContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(AlertDialogHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(AlertDialogTitle, { children: config?.labels?.deleteConfirmTitle || "Delete Conversation" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(AlertDialogDescription, { children: config?.labels?.deleteConfirmDescription || "Are you sure you want to delete this conversation? This action cannot be undone." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(AlertDialogFooter, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(AlertDialogCancel, { children: config?.labels?.cancel || "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
          AlertDialogAction,
          {
            onClick: () => deleteThreadId && handleDeleteThread(deleteThreadId),
            className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            children: config?.labels?.deleteThread || "Delete"
          }
        )
      ] })
    ] }) })
  ] }) });
};

// src/lib/chatUtils.ts
var chatUtils = {
  generateId: () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  generateMessageId: () => chatUtils.generateId(),
  generateThreadId: () => chatUtils.generateId(),
  createMessage: (role, content, attachments) => ({
    id: chatUtils.generateMessageId(),
    role,
    content,
    timestamp: Date.now(),
    attachments,
    isComplete: true
  }),
  createThread: (title) => ({
    id: chatUtils.generateThreadId(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0
  }),
  generateThreadTitle: (firstMessage) => {
    const cleaned = firstMessage.replace(/[^\w\s]/g, "").trim();
    const words = cleaned.split(/\s+/).slice(0, 6);
    return words.join(" ") || "Nova Conversa";
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChatHeader,
  ChatInput,
  ChatUI,
  ChatUserContextProvider,
  Message,
  Sidebar,
  ThreadManager,
  UserMenu,
  UserProfile,
  chatConfigPresets,
  chatUtils,
  cn,
  configUtils,
  defaultChatConfig,
  featureFlags,
  formatDate,
  mergeConfig,
  themeUtils,
  useChatUserContext,
  validateConfig
});
//# sourceMappingURL=index.cjs.map