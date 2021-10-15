'use strict';

(() => {
    const $stor = selector => document.querySelector(selector);

    const pickerRoot = document.documentElement;
    const dialog = $stor('aside');

    const svgRoot = $stor('svg');
    const svgOcean = svgRoot.children[0];
    const svgIslands = svgRoot.children[1];
    const NoPaths = 'M0 0';

    const cmEditor = document.querySelector('.codeMirrorContainer');

    const onSvgClicked = function (ev) {
        if (pickerRoot.classList.contains('paused')) {
            unpausePicker();
            return;
        }

        let { x, y } = calculationDialogPosition(ev.clientX, ev.clientY);
        dialog.style.top = y + 'px';
        dialog.style.left = x + 'px';

        sendMessageToParent({
            what: 'filterElementAtPoint',
            mx: ev.clientX,
            my: ev.clientY,
            broad: ev.ctrlKey,
        })
    };

    const calculationDialogPosition = function (x, y) {
        let result = { x, y };
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let dialogWidth = 420;
        if (width>dialogWidth&&width<dialogWidth*2.5) {
            dialogWidth = width / 2.5;
        }

        if (x > width - dialogWidth) {
            result.x = width - dialogWidth;
            if (result.x<2) {
                result.x = 2;
            }
        }

        if (y > height - 125) {
            result.y = width - 125;
        }

        return result;
    };

    const onQuitClicked = function () {
        quitPicker();
    };


    const onKeyPressed = function (ev) {
        // Esc
        if (ev.key === 'Escape' || ev.which === 27) {
            onQuitClicked();
            return;
        }
    };

    const svgListening = (() => {
        let on = false;
        let timer;
        let mx = 0, my = 0;
        const onTimer = () => {
            timer = undefined;
            sendMessageToParent({
                what: 'highlightElementAtPoint',
                mx,
                my,
            });

        };

        const onHover = ev => {
            mx = ev.clientX;
            my = ev.clientY;
            if (timer === undefined) {
                timer = self.requestAnimationFrame(onTimer);
            }
        };

        return state => {
            if (state === on) { return; }
            on = state;
            if (on) {
                document.addEventListener('mousemove', onHover, { passive: true });
                return;
            }
            document.removeEventListener('mousemove', onHover, { passive: true });
            if (timer !== undefined) {
                self.cancelAnimationFrame(timer);
                timer = undefined;
            }
        };
    })();

    const showDialog = function (details) {
        pausePicker();

        const { text } = details;

        if (!text || text.length == 0) {
            cmEditor.value = '';
            return;
        }
        cmEditor.value = text.join('\r\n');
    };

    const pausePicker = function () {
        pickerRoot.classList.add('paused');
        svgListening(false);
    };

    const unpausePicker = function () {
        pickerRoot.classList.remove('paused');
        sendMessageToParent({
            what: 'togglePreview',
            state: false,
        });
        svgListening(true);
    };

    const startPicker = function () {
        self.addEventListener('keydown', onKeyPressed, true);
        const svg = $stor('svg');
        svg.addEventListener('click', onSvgClicked);

        unpausePicker();
    };

    const quitPicker = function () {
        sendMessageToParent({ what: 'quitPicker' });
    };

    const onPickerMessage = function (msg) {
        switch (msg.what) {
            case 'showDialog':
                showDialog(msg);
                break;
            case 'svgPaths': {
                let { ocean, islands } = msg;
                ocean += islands;
                svgOcean.setAttribute('d', ocean);
                svgIslands.setAttribute('d', islands || NoPaths);
                break;
            }
            default:
                break;
        }
    };

    const onConnectionMessage = function (msg) {
        switch (msg.what) {
            case 'connectionMessage':
                onPickerMessage(msg.payload);
                break;
            case 'showDialog':
                showDialog(msg);
                break;
            case 'svgPaths': {
                let { ocean, islands } = msg;
                ocean += islands;
                svgOcean.setAttribute('d', ocean);
                svgIslands.setAttribute('d', islands || NoPaths);
                break;
            }
            case 'connectionAccepted':
                startPicker();
                sendMessageToParent({ what: 'start' });
                break;
        }
    };

    window.addEventListener('message', function (e) {
        if (e.source != window.parent) {
            return;
        }

        onConnectionMessage(e.data);
    }, false);

    const sendMessageToParent = function (msg) {
        window.parent.postMessage(msg, '*');
    }
})();