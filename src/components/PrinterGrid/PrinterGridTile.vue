<template>
  <div v-drop-printer-position="{ x, y, printerSet: printer }">
    <v-card
      v-drop-upload="{ printers: [printer] }"
      :class="{
        'tile-large': largeTilesEnabled,
        'tile-selected': selected,
        'tile-unselected': unselected,
        'tile-no-printer': !printer,
        'tile-with-camera': hasCameraStream && isOnline,
      }"
      class="tile colored-tile rounded-lg"
      elevation="5"
      @click="selectOrClearPrinterPosition()"
    >
      <!-- Header row with printer name and menu button -->
      <div v-if="printer && !gridStore.gridEditMode" class="printer-header">
        <div class="printer-title">
          {{ printer?.name ?? "&nbsp;" }}
        </div>
        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              color="darkgray"
              elevation="0"
              x-small
              style="border-radius: 7px"
              v-bind="attrs"
              v-on="on"
              @click.prevent.stop="clickInfo()"
            >
              <v-icon dark small>menu</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Open printer details</template>
        </v-tooltip>
      </div>
      <div v-else-if="printer" class="printer-title">
        {{ printer?.name ?? "&nbsp;" }}
      </div>

      <!-- Camera stream section (centered in tile body) -->
      <div v-if="!!printer && isOnline && cameraStream && cameraStream.streamURL" class="camera-stream-container">
        <img
          :src="cameraStream.streamURL"
          :style="cameraStreamStyle"
          alt="Camera stream"
          class="camera-stream-img"
          @error="cameraError = true"
        />
      </div>

      <!-- Create printer - hover button-->
      <div
        v-if="!printer || gridStore.gridEditMode"
        :style="{
          height: largeTilesEnabled ? 'calc(120px - 20px)' : 'calc(84px - 20px)',
        }"
        class="plus-hover-icon"
        style="position: absolute"
      >
        <div class="d-flex flex flex-column justify-center" style="height: 100%">
          <PrinterCreateAction
            v-if="!printer"
            :floor-id="floorStore.selectedFloor?.id"
            :floor-x="x"
            :floor-y="y"
          />
          <v-btn
            v-if="printer"
            color="error"
            rounded
            small
            @click.c.capture.native.stop="selectOrClearPrinterPosition()"
          >
            <v-icon>clear</v-icon>
            Clear position
          </v-btn>
        </div>
      </div>

      <div v-if="!!printer && isOnline && !hasCameraStream" class="printer-file-or-stream-viewer">
        <v-img
          v-if="!thumbnail?.length"
          :src="require('@/assets/logo.png')"
          :width="tileIconThumbnailSize"
          alt="No thumbnail was found in GCode"
          style="opacity: 0.3; filter: grayscale(100%)"
        />
        <v-img
          v-else
          :src="'data:image/png;base64,' + (thumbnail ?? '')"
          :width="tileIconThumbnailSize"
        />
      </div>
      <div v-else-if="!!printer" class="printer-file-or-stream-viewer">
        <v-icon
          v-if="printerState?.text.includes('API')"
          :size="tileIconThumbnailSize"
          color="secondary"
        >
          wifi_off
        </v-icon>
        <v-icon v-if="!printer.enabled" :size="tileIconThumbnailSize" color="secondary">
          disabled_by_default
        </v-icon>
        <v-icon
          v-if="printerState?.text.includes('unset')"
          :size="tileIconThumbnailSize"
          color="secondary"
        >
          question_mark
        </v-icon>
      </div>

      <div
        v-if="printer && !gridStore.gridEditMode"
        :style="{
          position: largeTilesEnabled ? 'inherit' : 'absolute',
          top: largeTilesEnabled ? 'inherit' : '30px',
        }"
        class="printer-controls"
        style="overflow: clip"
      >
        <small class="file-name">{{ currentPrintingFilePath ?? "&nbsp;" }}</small>
      </div>

      <!-- Hover controls -->
      <div v-if="printer && !gridStore.gridEditMode" class="centered-controls">
        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :disabled="!isOnline || !isOperational"
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="clickOpenPrinterControlDialog()"
            >
              <v-icon>open_with</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Move and home printer</template>
        </v-tooltip>

        <!-- Connect USB -->
        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              v-if="!isOperational && isOnline"
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="clickConnectUsb()"
            >
              <v-icon>usb</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Connect USB (only for OctoPrint)</template>
        </v-tooltip>

        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="clickRefreshSocket()"
            >
              <v-icon>refresh</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Reload printer websocket and refresh all states</template>
        </v-tooltip>

        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :disabled="!isOnline || (!isPaused && !isPrinting)"
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="isPaused ? clickResumePrint() : clickPausePrint()"
            >
              <v-icon v-if="!isPaused">pause</v-icon>
              <v-icon v-if="isPaused">play_arrow</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>
            {{ isPaused ? "Resume print" : "Pause print" }}
          </template>
        </v-tooltip>

        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :disabled="!isOnline || (preferCancelOverQuickStop && !isPrinting && !isPaused)"
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="preferCancelOverQuickStop ? clickStop() : clickQuickStop()"
            >
              <v-icon>{{ preferCancelOverQuickStop ? "stop" : "dangerous" }}</v-icon>
            </v-btn>
          </template>
          <template v-slot:default
            >{{
              preferCancelOverQuickStop
                ? "Cancel current print gracefully"
                : "Perform quick stop of printer"
            }}
          </template>
        </v-tooltip>

        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="clickOpenSettings()"
            >
              <v-icon>settings</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Open printer settings</template>
        </v-tooltip>

        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              :disabled="!isOnline"
              :small="largeTilesEnabled"
              color="darkgray"
              elevation="0"
              style="border-radius: 7px"
              v-bind="attrs"
              x-small
              v-on="on"
              @click.prevent.stop="clickOpenTerminalDialog()"
            >
              <v-icon>terminal</v-icon>
            </v-btn>
          </template>
          <template v-slot:default>Open terminal</template>
        </v-tooltip>
      </div>

      <!-- Temperature Display for Moonraker -->
      <div
        v-if="printer && !gridStore.gridEditMode && isMoonraker && hasTemperatureData && isOnline"
        class="temperature-display"
      >
        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <span 
              class="temp-item temp-clickable" 
              v-bind="attrs" 
              v-on="on"
              @click.stop="clickSetExtruderTemp()"
            >
              <v-icon x-small color="orange">mdi-printer-3d-nozzle-heat</v-icon>
              <span class="temp-value">{{ extruderTemp }}°</span>
              <span v-if="extruderTarget && extruderTarget > 0" class="temp-target">/{{ extruderTarget }}°</span>
            </span>
          </template>
          <template v-slot:default>Click to set extruder temperature ({{ extruderTemp }}°C / {{ extruderTarget ?? 0 }}°C)</template>
        </v-tooltip>
        <v-tooltip top>
          <template v-slot:activator="{ on, attrs }">
            <span 
              class="temp-item temp-clickable" 
              v-bind="attrs" 
              v-on="on"
              @click.stop="clickSetBedTemp()"
            >
              <v-icon x-small color="red">mdi-radiator</v-icon>
              <span class="temp-value">{{ bedTemp }}°</span>
              <span v-if="bedTarget && bedTarget > 0" class="temp-target">/{{ bedTarget }}°</span>
            </span>
          </template>
          <template v-slot:default>Click to set bed temperature ({{ bedTemp }}°C / {{ bedTarget ?? 0 }}°C)</template>
        </v-tooltip>
      </div>

      <!-- Progress Bar -->
      <v-progress-linear
        v-if="printer && !gridStore.gridEditMode"
        :value="currentJob?.progress?.completion"
        background-color="dark-gray"
        class="progress-bar"
        height="14"
      >
        <template v-slot:default="{ value }">
          <strong> {{ value?.toFixed(1) + "%" }} </strong>

          <v-tooltip
            :disabled="printer?.enabled"
            close-delay="100"
            color="danger"
            open-delay="0"
            top
          >
            <template v-slot:activator="{ on, attrs }">
              <span class="xsmall-resized-font text--secondary ml-sm-2" v-bind="attrs" v-on="on">
                <span v-if="printer?.disabledReason">
                  <small> MAINTENANCE</small>
                  <v-icon class="d-none d-xl-inline" color="primary" small>info</v-icon>
                </span>
                <span v-else>
                  <small
                    :style="{
                      'background-color': printerStateColor + '99',
                      'border-left': '5px solid ' + printerStateColor + 'ff',
                      padding: '5px',
                    }"
                  >
                    {{ printerState?.text?.toUpperCase() }}
                  </small>
                </span>
              </span>
            </template>

            <template #default>
              <span>
                {{ printer?.disabledReason ?? "Printer disabled" }}
              </span>
            </template>
          </v-tooltip>
        </template>
      </v-progress-linear>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { computed, PropType, ref, watch } from "vue";
import { CustomGcodeService } from "@/backend/custom-gcode.service";
import { PrintersService } from "@/backend";
import { usePrinterStore } from "@/store/printer.store";
import { DialogName } from "@/components/Generic/Dialogs/dialog.constants";
import { useGridStore } from "@/store/grid.store";
import { FloorService } from "@/backend/floor.service";
import { useSettingsStore } from "@/store/settings.store";
import { useFloorStore } from "@/store/floor.store";
import { interpretStates } from "@/shared/printer-state.constants";
import { usePrinterStateStore } from "@/store/printer-state.store";
import { PrinterDto } from "@/models/printers/printer.model";
import { useSnackbar } from "@/shared/snackbar.composable";
import { useDialog } from "@/shared/dialog.composable";
import { PrinterJobService } from "@/backend/printer-job.service";
import { useThumbnailQuery } from "@/queries/thumbnail.query";
import PrinterCreateAction from "@/components/Generic/Actions/PrinterCreateAction.vue";
import { isMoonrakerType } from "@/utils/printer-type.utils";
import { CameraStreamService } from "@/backend/camera-stream.service";
import { CameraStream } from "@/models/camera-streams/camera-stream";

const defaultColor = "rgba(100,100,100,0.1)";

const props = defineProps({
  printer: { type: Object as PropType<PrinterDto | undefined>, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
});

const printerStore = usePrinterStore();
const printerStateStore = usePrinterStateStore();
const floorStore = useFloorStore();
const settingsStore = useSettingsStore();
const gridStore = useGridStore();
const controlDialog = useDialog(DialogName.PrinterControlDialog);
const terminalDialog = useDialog(DialogName.PrinterTerminalDialog);
const addOrUpdateDialog = useDialog(DialogName.AddOrUpdatePrinterDialog);
const snackbar = useSnackbar();

const printerId = computed(() => props.printer?.id);

const { data: thumbnail } = useThumbnailQuery(printerId, settingsStore.thumbnailsEnabled);

// Camera stream for the printer
const cameraStream = ref<CameraStream | null>(null);
const cameraError = ref(false);

watch(
  printerId,
  async (newPrinterId) => {
    if (!newPrinterId) {
      cameraStream.value = null;
      return;
    }
    try {
      cameraStream.value = await CameraStreamService.getCameraStreamByPrinterId(newPrinterId);
      cameraError.value = false;
    } catch (e) {
      cameraStream.value = null;
    }
  },
  { immediate: true }
);

const cameraStreamStyle = computed(() => {
  if (!cameraStream.value) return {};
  const transforms: string[] = [];
  
  if (cameraStream.value.rotationClockwise) {
    transforms.push(`rotate(${cameraStream.value.rotationClockwise}deg)`);
  }
  if (cameraStream.value.flipHorizontal) {
    transforms.push("scaleX(-1)");
  }
  if (cameraStream.value.flipVertical) {
    transforms.push("scaleY(-1)");
  }
  
  return {
    transform: transforms.join(" ") || undefined,
  };
});

const hasCameraStream = computed(() => {
  return cameraStream.value && cameraStream.value.streamURL;
});

const largeTilesEnabled = computed(() => settingsStore.largeTiles);
const tileIconThumbnailSize = computed(() => (largeTilesEnabled.value ? "80px" : "40px"));

const isOnline = computed(() =>
  printerId.value ? printerStateStore.isApiResponding(printerId.value) : false
);

const isOperational = computed(() =>
  printerId.value ? printerStateStore.isPrinterOperational(printerId.value) : false
);

const isPrinting = computed(() => {
  return printerId.value ? printerStateStore.isPrinterPrinting(printerId.value) : false;
});

const isPaused = computed(() => {
  if (!printerId.value) return false;

  return printerStateStore.isPrinterPaused(printerId.value);
});

const selected = computed(() => {
  if (!printerId.value) return false;
  return printerStore.isSelectedPrinter(printerId.value);
});

const unselected = computed(() => {
  return printerStore.selectedPrinters?.length && !selected.value;
});

const preferCancelOverQuickStop = computed(() => {
  return settingsStore.preferCancelOverQuickStop;
});

const printerState = computed(() => {
  if (!printerId.value) return;
  const printer = printerStore.printer(printerId.value);
  if (!printer) return;

  const printerEvents = printerStateStore.printerEventsById[printerId.value];
  const socketState = printerStateStore.socketStatesById[printerId.value];
  return interpretStates(printer, socketState, printerEvents);
});

const printerStateColor = computed(() => {
  const states = printerState.value;
  if (!states) {
    return defaultColor;
  }
  return states.rgb || defaultColor;
});

const currentJob = computed(() => {
  if (!printerId.value) return;
  return printerStateStore.printerJobsById[printerId.value];
});

const currentPrintingFilePath = computed(() => {
  if (!printerId.value) return;
  return printerStateStore.printingFilePathsByPrinterId[printerId.value];
});

// Temperature data for Moonraker printers
const isMoonraker = computed(() => isMoonrakerType(props.printer?.printerType));

const temperatureData = computed(() => {
  if (!printerId.value || !isMoonraker.value) return undefined;
  return printerStateStore.printerTemperatureById(printerId.value);
});

const extruderTemp = computed(() => {
  const temp = temperatureData.value?.extruder?.temperature;
  return temp !== undefined ? Math.round(temp) : null;
});

const extruderTarget = computed(() => {
  const target = temperatureData.value?.extruder?.target;
  return target !== undefined ? Math.round(target) : null;
});

const bedTemp = computed(() => {
  const temp = temperatureData.value?.heater_bed?.temperature;
  return temp !== undefined ? Math.round(temp) : null;
});

const bedTarget = computed(() => {
  const target = temperatureData.value?.heater_bed?.target;
  return target !== undefined ? Math.round(target) : null;
});

const hasTemperatureData = computed(() => {
  return extruderTemp.value !== null || bedTemp.value !== null;
});

const clickSetExtruderTemp = async () => {
  if (!printerId.value) return;
  
  const currentTarget = extruderTarget.value ?? 0;
  const input = prompt(`Set extruder temperature (current target: ${currentTarget}°C):`, currentTarget.toString());
  
  if (input === null) return; // User cancelled
  
  const temp = parseInt(input, 10);
  if (isNaN(temp) || temp < 0 || temp > 300) {
    snackbar.openErrorMessage({ title: "Invalid temperature. Please enter a value between 0 and 300°C." });
    return;
  }
  
  try {
    await PrintersService.setExtruderTemperature(printerId.value, temp);
    snackbar.openInfoMessage({ title: `Extruder temperature set to ${temp}°C` });
  } catch (e) {
    snackbar.openErrorMessage({ title: "Failed to set extruder temperature" });
  }
};

const clickSetBedTemp = async () => {
  if (!printerId.value) return;
  
  const currentTarget = bedTarget.value ?? 0;
  const input = prompt(`Set bed temperature (current target: ${currentTarget}°C):`, currentTarget.toString());
  
  if (input === null) return; // User cancelled
  
  const temp = parseInt(input, 10);
  if (isNaN(temp) || temp < 0 || temp > 120) {
    snackbar.openErrorMessage({ title: "Invalid temperature. Please enter a value between 0 and 120°C." });
    return;
  }
  
  try {
    await PrintersService.setBedTemperature(printerId.value, temp);
    snackbar.openInfoMessage({ title: `Bed temperature set to ${temp}°C` });
  } catch (e) {
    snackbar.openErrorMessage({ title: "Failed to set bed temperature" });
  }
};

const clickStop = async () => {
  if (!printerId.value) return;

  if (confirm("Are you sure to cancel the current print job?")) {
    await PrinterJobService.stopPrintJob(printerId.value);
  }
};

const clickPausePrint = async () => {
  if (!printerId.value) return;

  await PrinterJobService.pausePrintJob(printerId.value);
};

const clickResumePrint = async () => {
  if (!printerId.value) return;

  await PrinterJobService.resumePrintJob(printerId.value);
};

const clickInfo = () => {
  printerStore.setSideNavPrinter(props.printer);
};

const clickRefreshSocket = async () => {
  if (!printerId.value) return;
  await PrintersService.refreshSocket(printerId.value);
  snackbar.openInfoMessage({
    title: "Refreshing connection state",
  });
};

const clickOpenSettings = () => {
  printerStore.setUpdateDialogPrinter(props.printer);
  addOrUpdateDialog.openDialog();
};

const clickOpenPrinterControlDialog = async () => {
  if (!printerId.value) {
    throw new Error("PrinterId not set, cant open dialog");
  }

  await controlDialog.openDialog({ printerId: printerId.value });
};

const clickOpenTerminalDialog = async () => {
  if (!printerId.value) {
    throw new Error("PrinterId not set, cant open dialog");
  }

  await terminalDialog.openDialog({ printerId: printerId.value });
};

const clickQuickStop = async () => {
  if (!printerId.value) return;

  if (confirm("Are you sure to abort the print in Quick Stop mode? Please reconnect after.")) {
    await CustomGcodeService.postQuickStopM112Command(printerId.value);
  }
};

const clickConnectUsb = async () => {
  if (!printerId.value) return;
  await PrintersService.sendPrinterConnectCommand(printerId.value);
};

const selectOrClearPrinterPosition = async () => {
  if (!props.printer || !printerId.value) {
    return;
  }

  if (gridStore.gridEditMode) {
    const floorId = floorStore.selectedFloor?.id;
    if (!floorId) throw new Error("Cant clear printer, floor not selected");
    await FloorService.deletePrinterFromFloor(floorId, printerId.value);
    return;
  }

  printerStore.toggleSelectedPrinter(props.printer);
};
</script>

<style scoped>
.tile {
  min-height: 84px;
  max-height: none;
}

.tile-large {
  min-height: 120px;
}

.tile-with-camera {
  min-height: 180px;
}

.tile-large.tile-with-camera {
  min-height: 220px;
}

.colored-tile {
  padding: 8px;
  color: #ffffff;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: background-color 0.2s;
}

.tile-selected {
  outline: 2px solid var(--v-primary-base);
  opacity: 1;
}

.tile.tile-no-printer {
  background-color: #171717;
  height: 84px;
  border: 2px #3a3a3a dashed !important;
  outline: none;
}

.tile.tile-large {
  min-height: 120px;
}

.tile-no-printer:hover {
  background-color: #2a2a2a;
  cursor: not-allowed;
}

.plus-hover-icon {
  display: none;
}

.tile-no-printer:hover .plus-hover-icon {
  display: block;
}

.tile:hover .plus-hover-icon {
  display: block;
}

.printer-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.printer-header .printer-title {
  flex: 1;
  text-align: center;
  padding-left: 28px; /* Balance out the button width */
}

.printer-title {
  font-size: 16px !important;
  font-weight: bold;
  text-align: center;
  color: #ffffff;
  flex-shrink: 0;
}

.camera-stream-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
  margin: 6px 0;
}

.camera-stream-img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.printer-file-or-stream-viewer {
  position: absolute;
  left: 16px;
  height: calc(100% - 36px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.printer-controls {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0;
  margin-bottom: 8px;
}

.file-name {
  font-size: 14px;
  color: #bfbfbf;
  max-width: 70%;
  display: block;
  text-wrap: nowrap;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.centered-controls {
  opacity: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
  transition: opacity 0.2s;
}

.colored-tile:hover .centered-controls {
  opacity: 1;
}

.control-icons v-btn {
  color: #ffffff;
}

.temperature-display {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 2px;
  margin-top: auto;
  font-size: 13px;
  color: #e0e0e0;
  flex-shrink: 0;
}

.temp-item {
  display: flex;
  align-items: center;
  gap: 1px;
}

.temp-clickable {
  cursor: pointer;
  padding: 1px 3px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.temp-clickable:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.temp-value {
  font-weight: bold;
  color: #ffffff;
}

.temp-target {
  color: #888888;
  font-size: 9px;
}

.progress-bar {
  width: 100%;
  background-color: #2c2c2c;
  border-radius: 7px !important;
  flex-shrink: 0;
  margin-top: auto;
}
</style>
