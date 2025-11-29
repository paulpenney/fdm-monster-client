import { PrinterDto } from "@/models/printers/printer.model";
import { IdType } from "@/utils/id.type";

export interface CreateCameraStreamDto {
  streamURL: string;
  name?: string;
  printerId?: IdType;
  aspectRatio?: string;
  rotationClockwise?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

export interface CameraStream {
  id?: IdType;
  printerId?: IdType;
  streamURL: string;
  name?: string;
  aspectRatio?: string;
  rotationClockwise?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

export interface CameraWithPrinter {
  printer: PrinterDto;
  cameraStream: CameraStream;
}
