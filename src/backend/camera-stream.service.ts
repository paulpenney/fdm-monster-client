import { BaseService } from "./base.service";
import { CameraStream, CreateCameraStreamDto } from "@/models/camera-streams/camera-stream";
import { getHttpClient } from "@/shared/http-client";

export class CameraStreamService extends BaseService {
  static async listCameraStreams() {
    return await this.get<CameraStream[]>("/api/camera-stream/");
  }

  static async createCameraStream(cameraStreamDto: CreateCameraStreamDto) {
    return await this.post<CameraStream>("/api/camera-stream/", cameraStreamDto);
  }

  static async getCameraStream(cameraStreamId: string | number) {
    return await this.get<CameraStream>(`/api/camera-stream/${cameraStreamId}`);
  }

  static async getCameraStreamByPrinterId(printerId: string | number): Promise<CameraStream | null> {
    const httpClient = await getHttpClient(true);
    const response = await httpClient.get<CameraStream>(`/api/camera-stream/printer/${printerId}`);
    if (response.status === 204) {
      return null;
    }
    return response.data;
  }

  static async updateCameraStream(
    cameraStreamId: string | number,
    cameraStreamDto: CreateCameraStreamDto
  ) {
    return await this.put<CameraStream>(`/api/camera-stream/${cameraStreamId}`, cameraStreamDto);
  }

  static async deleteCameraStream(cameraStreamId: string | number) {
    return await this.delete(`/api/camera-stream/${cameraStreamId}`);
  }
}
