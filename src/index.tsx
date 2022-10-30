import {
    definePlugin,
    Router,
    ServerAPI,
    staticClasses,
    findModuleChild
} from "decky-frontend-lib";
import { VFC } from "react";
import { FaShip } from "react-icons/fa";

import Whiteboard from "./components/Whiteboard";
import Gallery from "./components/Gallery";
import { GetImageService, ImageService } from "./services/imageService";
import { GetSteamClient, UnregisterHandle } from "./steam/steamClient";
import { GetSteamService } from "./steam/steamService";
import { PatchModalService } from "./patches/dialogModalPatcher";
import { ScreenshotNotification, SideMenu } from "./components/SideMenu";
import { GalleryRoutePath, WhiteboardRoutePath } from "./routes";

const addWhiteboardRoute = (
    serverApi: ServerAPI, 
    findScreenshotUrl: (path:string|undefined) => Promise<string>,
    saveImageAndNotify: (image:string) => Promise<void>) => {

    interface WhiteboardRouteParameters {
        path: string | undefined;
    }
    
    const WhiteboardRoute: VFC<WhiteboardRouteParameters> = ({path}) => {
        return (
            <Whiteboard pickImage={() => findScreenshotUrl(path)} 
                        saveWhiteboard={(image) => saveImageAndNotify(image)}></Whiteboard>
        );
    };

    serverApi.routerHook.addRoute(`${WhiteboardRoutePath}/:screenshotHandle`, () => (
        <WhiteboardRoute path={window.location.href.toString().split('/').pop()}></WhiteboardRoute>
    ), {
        exact: true,
    });
};

const addGalleryRoute = (serverApi: ServerAPI, imageService:ImageService) => {

    const GalleryRoute: VFC = () => {
        return (
            <Gallery getAllImages={() => imageService.callListImagesApi()} 
                     getImage={(fileName) => imageService.callGetImageApi(fileName)}
                     deleteImage={(fileName) => imageService.callDeleteImageApi(fileName)}></Gallery>
        );
    };

    serverApi.routerHook.addRoute(GalleryRoutePath, () => (
        <GalleryRoute></GalleryRoute>
    ), {
        exact: true,
    });
};

const patchDeckyNotesButtonIntoDialogModal = (goToWhiteBoard: (screenshotHandle:string) => void) => {
    var ModalDialogButton = findModuleChild((m) => {
        if (typeof m !== 'object')
            return undefined;
        for (let prop in m) {
            if (m[prop]?.toString()?.includes('contextMenuItem') && m[prop]?.toString()?.includes('onSelected')) {
                return m[prop];
            }
        }
    })
    const DeckyNotesButton = ({screenshotHandle}:{screenshotHandle:string}): JSX.Element => {
        return (
            <ModalDialogButton onSelected={() => goToWhiteBoard(screenshotHandle)}>Edit in Decky Notes</ModalDialogButton>
        );
    };
    return PatchModalService((e, ret) => {
        if (/^.*\/routes\/media(\/.*)?$/.test(window.location.href)) {
            const screenshotHandle = e.props.screenshotHandle;
            const existingDeckyNotesButton = ret.props.children.find((x:any) => x.type === DeckyNotesButton);
            if (!existingDeckyNotesButton) {
                ret.props.children.unshift(
                    <DeckyNotesButton screenshotHandle={screenshotHandle} />
                );
            } else if (existingDeckyNotesButton.props.screenshotHandle !== screenshotHandle) {
                ret.props.children[ret.props.children.indexOf(existingDeckyNotesButton)] = <DeckyNotesButton screenshotHandle={screenshotHandle} />;
            }
        }
    });
}

export default definePlugin((serverApi: ServerAPI) => {
    const imageService = GetImageService(serverApi);
    const steamClient = GetSteamClient();
    const steamService = GetSteamService();

    const screenshotUnregisterStorage = new Map<(notification: ScreenshotNotification) => void, UnregisterHandle>();
    const screenshotNotifier = {
        registerForScreenshotNotifications: async (callback: (notification: ScreenshotNotification) => void) => {
            var screenshot = await steamClient.Screenshots.GetLastScreenshotTaken();
            var handle = steamClient.GameSessions.RegisterForScreenshotNotification((notification) => {
                callback({
                    ImageSrcUrl: notification.details.strUrl,
                    ScreenshotHandle: `local_${notification.details.hHandle.toString()}`
                })
            });
            screenshotUnregisterStorage.set(callback, handle);
            if (screenshot) {
                callback({
                    ImageSrcUrl: screenshot.strUrl,
                    ScreenshotHandle: `local_${screenshot.hHandle.toString()}`
                })
            }
        },
        unregisterForScreenshotNotifications: (callback: (notification: ScreenshotNotification) => void) =>{
            screenshotUnregisterStorage.get(callback)?.unregister();
        }
    };

    const findScreenshotUrl = async (screenshotHandle: string | undefined) => {
        if (!screenshotHandle) {
            return '';
        }
        var result = await steamService.getScreenshotDetails(screenshotHandle);
        return result.image_url;
    }

    const saveImageAndNotify = async (image: string): Promise<void> => {
        var fileName = await imageService.callSaveImageApi(image);
        serverApi.toaster.toast({
            title: 'Note saved!',
            body: 'Saved at: ' + fileName            
        });
    }

    const goToWhiteBoard = (screenshotHandle: string) => {
        Router.Navigate(`${WhiteboardRoutePath}/${screenshotHandle}`)
    };

    const patch = patchDeckyNotesButtonIntoDialogModal(goToWhiteBoard);
    addWhiteboardRoute(serverApi, findScreenshotUrl, saveImageAndNotify);
    addGalleryRoute(serverApi, imageService);

    console.log('Decky Notes loaded');

    return {
        title: <div className={staticClasses.Title}>Decky Notes</div>,
        content: <SideMenu notifier={screenshotNotifier} />,
        icon: <FaShip />,
        onDismount() {
            patch.unpatch();
            serverApi.routerHook.removeRoute(WhiteboardRoutePath);
            serverApi.routerHook.removeRoute(GalleryRoutePath);            
        },
    };
});