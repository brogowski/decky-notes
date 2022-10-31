import { ServerAPI } from "decky-frontend-lib";

export interface ImageService {
    callSaveImageApi: (image: string) => Promise<string>;
    callListImagesApi: () => Promise<string[]>;
    callGetImageApi: (fileName: string) => Promise<string>;
    callDeleteImageApi: (fileName: string) => Promise<void>
}

const saveImagePart = async (serverAPI: ServerAPI, image: string, fileName: string): Promise<void> => {
    const response = await serverAPI.callPluginMethod<{}, string>('save_image', { image: image, 'file_name': fileName});
    if (!response.success) {
        throw Error("Could not save drawing. " + response.result);
    }
}

const listImages = async (serverAPI: ServerAPI): Promise<string[]> => {
    const response = await serverAPI.callPluginMethod<{}, string[]>('list_images', {});
    if (response.success) {
        return response.result;        
    }
    throw Error("Could not get images. " + response.result);
}

const getImage = async (serverAPI: ServerAPI, fileName: string): Promise<string> => {
    const response = await serverAPI.callPluginMethod<{}, string>('get_image', {'file_name': fileName});
    if (response.success) {
        return response.result;        
    }
    throw Error("Could not get image: " + fileName + " " + response.result);
}

const deleteImage = async (serverAPI: ServerAPI, fileName: string): Promise<void> => {
    const response = await serverAPI.callPluginMethod<{}, string[]>('delete_image', {'file_name': fileName});
    if (!response.success) {
        throw Error("Could delete image " + fileName + " " + response.result);
    }
}

const saveImage = async (serverAPI: ServerAPI, encodedImage: string) => {
    const maxSize = (1024 * 1024) / 2;
    const encodedBytes = encodedImage.split(',')[1];
    const binaryImage = atob(encodedBytes);
    const partsCount = Math.ceil(binaryImage.length/maxSize);
    const partSize = binaryImage.length / partsCount;
    const leftOver = binaryImage.length % partsCount;
    const parts = [...Array(partsCount).keys()]
                    .map(index => binaryImage.slice(partSize*index,((partSize*index)+partSize)+(index===(partsCount-1)?leftOver:0)))
                    .map(binary => btoa(binary))
    const date = new Date();
    const fileName = `${date.getFullYear()}${date.getMonth()}${date.getDay()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}${date.getMilliseconds()}.png`
    for (const part of parts) {
        await saveImagePart(serverAPI, part, fileName);
    }
    return fileName;
}

export const GetImageService = (serverAPI:ServerAPI):ImageService => {
    return {
        callSaveImageApi: (image: string) => saveImage(serverAPI, image),
        callListImagesApi: () => listImages(serverAPI),
        callGetImageApi: (fileName: string) => getImage(serverAPI, fileName),
        callDeleteImageApi: (fileName: string) => deleteImage(serverAPI, fileName)
    }
};