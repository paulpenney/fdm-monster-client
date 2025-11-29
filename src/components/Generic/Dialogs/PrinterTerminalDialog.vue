<template>
  <BaseDialog
    :id="dialog.dialogId"
    :max-width="'800px'"
    @beforeOpened="onBeforeDialogOpened"
    @opened="onDialogOpened"
    @escape="closeDialog()"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-console</v-icon>
        Terminal - {{ printer?.name }}
      </v-card-title>
      <v-card-text>
        <div class="terminal-container" ref="terminalContainer">
          <div class="terminal-output">
            <div
              v-for="(line, index) in terminalHistory"
              :key="index"
              :class="getLineClass(line)"
              class="terminal-line"
            >
              <span class="line-timestamp">{{ formatTime(line.timestamp) }}</span>
              <span class="line-content">{{ line.content }}</span>
            </div>
            <div v-if="terminalHistory.length === 0" class="terminal-empty">
              No terminal history. Send a command to get started.
            </div>
          </div>
        </div>
        <v-form @submit.prevent="sendCommand" class="mt-4">
          <v-text-field
            v-model="commandInput"
            label="Enter GCode command"
            placeholder="e.g., G28, M104 S200, G1 X10 Y10"
            outlined
            dense
            hide-details
            :disabled="!isOnline || isSending"
            append-icon="mdi-send"
            @click:append="sendCommand"
            ref="commandInputRef"
          >
            <template v-slot:prepend>
              <v-icon color="primary">mdi-chevron-right</v-icon>
            </template>
          </v-text-field>
        </v-form>
        <div class="mt-2 d-flex flex-wrap gap-2">
          <v-chip
            v-for="cmd in quickCommands"
            :key="cmd.command"
            small
            outlined
            color="primary"
            class="quick-command"
            @click="sendQuickCommand(cmd.command)"
            :disabled="!isOnline || isSending"
          >
            {{ cmd.label }}
          </v-chip>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn text small @click="clearHistory">
          <v-icon small class="mr-1">mdi-delete</v-icon>
          Clear History
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn text @click="closeDialog()">Close</v-btn>
      </v-card-actions>
    </v-card>
  </BaseDialog>
</template>

<script lang="ts" setup>
import { useDialog } from "@/shared/dialog.composable";
import { DialogName } from "@/components/Generic/Dialogs/dialog.constants";
import { computed, ref, nextTick, onMounted, onUnmounted } from "vue";
import { usePrinterStore } from "@/store/printer.store";
import { usePrinterStateStore } from "@/store/printer-state.store";
import { IdType } from "@/utils/id.type";
import { PrintersService } from "@/backend";
import { useSnackbar } from "@/shared/snackbar.composable";
import { useEventBus } from "@vueuse/core";
import { GcodeResponseEvent } from "@/shared/socketio.service";
import { isMoonrakerType } from "@/utils/printer-type.utils";

interface TerminalLine {
  type: "sent" | "received" | "error" | "info";
  content: string;
  timestamp: Date;
}

const dialog = useDialog<{ printerId: IdType }>(DialogName.PrinterTerminalDialog);
const printerStore = usePrinterStore();
const printerStateStore = usePrinterStateStore();
const snackbar = useSnackbar();
const gcodeResponseBus = useEventBus<GcodeResponseEvent>("gcode-response");

const printerId = ref<IdType>();
const commandInput = ref("");
const isSending = ref(false);
const terminalHistory = ref<TerminalLine[]>([]);
const terminalContainer = ref<HTMLElement | null>(null);
const commandInputRef = ref<any>(null);

const quickCommands = [
  { label: "Home All", command: "G28" },
  { label: "Home X/Y", command: "G28 X Y" },
  { label: "Home Z", command: "G28 Z" },
  { label: "Disable Steppers", command: "M18" },
  { label: "Get Position", command: "M114" },
  { label: "Get Temps", command: "M105" },
  { label: "Fan On", command: "M106 S255" },
  { label: "Fan Off", command: "M107" },
];

// Handle incoming GCode responses from Moonraker via Socket.IO
const handleGcodeResponse = async (event: GcodeResponseEvent) => {
  // Only show responses for the current printer
  if (event.printerId != printerId.value) return;
  
  terminalHistory.value.push({
    type: "received",
    content: event.message,
    timestamp: new Date(event.timestamp),
  });
  
  await nextTick();
  scrollToBottom();
};

onMounted(() => {
  gcodeResponseBus.on(handleGcodeResponse);
});

onUnmounted(() => {
  gcodeResponseBus.off(handleGcodeResponse);
});

function onBeforeDialogOpened() {
  console.log("Terminal dialog: onBeforeDialogOpened - clearing history");
  terminalHistory.value = [];
  commandInput.value = "";
  printerId.value = undefined;
}

async function onDialogOpened(input: { printerId: IdType }) {
  console.log("Terminal dialog: onDialogOpened for printer", input.printerId);
  printerId.value = input.printerId;
  
  // Get printer directly from store to ensure we have the data
  const currentPrinter = printerStore.printer(input.printerId);
  console.log("Terminal dialog: currentPrinter", currentPrinter?.name, "type:", currentPrinter?.printerType);
  
  // Load historical GCode responses for Moonraker printers
  if (currentPrinter && isMoonrakerType(currentPrinter.printerType)) {
    try {
      console.log("Terminal dialog: Fetching GCode history...");
      const history = await PrintersService.getGcodeHistory(input.printerId, 100);
      console.log("Terminal dialog: Loaded GCode history:", history.length, "entries");
      // Add history entries (oldest first)
      history.forEach((entry) => {
        terminalHistory.value.push({
          type: entry.type === "command" ? "sent" : "received",
          content: entry.message,
          timestamp: new Date(entry.time * 1000), // Convert Unix timestamp to Date
        });
      });
    } catch (e) {
      console.warn("Terminal dialog: Could not load GCode history:", e);
    }
  } else {
    console.log("Terminal dialog: Not a Moonraker printer or printer not found");
  }
  
  // Add welcome message
  terminalHistory.value.push({
    type: "info",
    content: `Connected to ${currentPrinter?.name || 'printer'}. Listening for GCode responses...`,
    timestamp: new Date(),
  });
  
  await nextTick();
  scrollToBottom();
  commandInputRef.value?.focus();
}

const printer = computed(() => {
  if (!printerId.value) return;
  return printerStore.printer(printerId.value);
});

const isOnline = computed(() =>
  printerId.value ? printerStateStore.isApiResponding(printerId.value) : false
);

const scrollToBottom = () => {
  if (terminalContainer.value) {
    terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
  }
};

const sendCommand = async () => {
  if (!commandInput.value.trim() || !printerId.value || isSending.value) return;

  const command = commandInput.value.trim().toUpperCase();
  isSending.value = true;

  // Add sent command to history
  terminalHistory.value.push({
    type: "sent",
    content: command,
    timestamp: new Date(),
  });

  commandInput.value = "";
  await nextTick();
  scrollToBottom();

  try {
    await PrintersService.sendGcode(printerId.value, command);
    // Response will come via Socket.IO gcode-response event
  } catch (e: any) {
    terminalHistory.value.push({
      type: "error",
      content: `Error: ${e.message || "Failed to send command"}`,
      timestamp: new Date(),
    });
    snackbar.openErrorMessage({ title: "Failed to send command" });
  } finally {
    isSending.value = false;
    await nextTick();
    scrollToBottom();
    commandInputRef.value?.focus();
  }
};

const sendQuickCommand = async (command: string) => {
  commandInput.value = command;
  await sendCommand();
};

const clearHistory = () => {
  terminalHistory.value = [];
  terminalHistory.value.push({
    type: "info",
    content: "History cleared.",
    timestamp: new Date(),
  });
};

const getLineClass = (line: TerminalLine) => {
  return `terminal-line-${line.type}`;
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const closeDialog = () => {
  printerId.value = undefined;
  dialog.closeDialog();
};
</script>

<style scoped>
.terminal-container {
  background-color: #1a1a1a;
  border-radius: 4px;
  padding: 12px;
  height: 300px;
  overflow-y: auto;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
}

.terminal-output {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal-line {
  display: flex;
  line-height: 1.4;
  word-break: break-all;
}

.line-timestamp {
  color: #666;
  user-select: none;
  flex-shrink: 0;
  margin-right: 8px;
  font-size: 11px;
}

.line-content {
  flex: 1;
}

.terminal-line-sent .line-content {
  color: #81c784;
}

.terminal-line-received .line-content {
  color: #90caf9;
}

.terminal-line-error .line-content {
  color: #ef9a9a;
}

.terminal-line-info .line-content {
  color: #ffcc80;
  font-style: italic;
}

.terminal-empty {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.quick-command {
  cursor: pointer;
  margin: 2px;
}

.gap-2 {
  gap: 8px;
}
</style>
