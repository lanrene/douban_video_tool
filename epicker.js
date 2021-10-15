(() => {
    if (window.doubanPicker) return;

    const doubanPicker = {
        sessionId: '',
        iframeHost: '',
        textFilterCandidates: [],
        targetElements: [],
        pickerRoot: null,

        initDoubanPicker: function (iframeHost) {
            if (!iframeHost || this.sessionId) { return; }

            this.sessionId = this.randomToken();
            this.iframeHost = iframeHost;

            // 主页面监听message事件,接收子组件的值
            let self = this;
            window.addEventListener('message', function (e) {
                if (e.origin == self.iframeHost) {
                    self.onDialogMessage(e.data)
                }
            }, false);
        },

        randomToken: function () {
            const n = Math.random();
            return String.fromCharCode(n * 26 + 97) +
                Math.floor(
                    (0.25 + n * 0.75) * Number.MAX_SAFE_INTEGER
                ).toString(36).slice(-8);
        },

        getElementBoundingClientRect: function (elem) {
            let rect = typeof elem.getBoundingClientRect === 'function'
                ? elem.getBoundingClientRect()
                : { height: 0, left: 0, top: 0, width: 0 };

            if (rect.width !== 0 && rect.height !== 0) {
                return rect;
            }

            let left = rect.left,
                right = rect.right,
                top = rect.top,
                bottom = rect.bottom;

            for (const child of elem.children) {
                rect = this.getElementBoundingClientRect(child);
                if (rect.width === 0 || rect.height === 0) {
                    continue;
                }
                if (rect.left < left) { left = rect.left; }
                if (rect.right > right) { right = rect.right; }
                if (rect.top < top) { top = rect.top; }
                if (rect.bottom > bottom) { bottom = rect.bottom; }
            }

            return {
                height: bottom - top,
                left,
                top,
                width: right - left
            };
        },

        highlightElements: function (elems, force) {
            if (
                (force !== true) &&
                (elems.length === this.targetElements.length) &&
                (elems.length === 0 || elems[0] === this.targetElements[0])
            ) {
                return;
            }
            this.targetElements = [];

            const ow = self.innerWidth;
            const oh = self.innerHeight;
            const islands = [];

            for (const elem of elems) {
                if (elem === this.pickerRoot) { continue; }
                this.targetElements.push(elem);
                const rect = this.getElementBoundingClientRect(elem);

                if (
                    rect.left > ow || rect.top > oh ||
                    rect.left + rect.width < 0 || rect.top + rect.height < 0
                ) {
                    continue;
                }
                islands.push(
                    `M${rect.left} ${rect.top}h${rect.width}v${rect.height}h-${rect.width}z`
                );
            }

            this.sendMessageToIframe({
                ocean: `M0 0h${ow}v${oh}h-${ow}z`,
                islands: islands.join(''),
                what: "svgPaths"
            });
        },

        textFilterFromElement: function (elem) {
            if (elem === null) { return 0; }
            if (elem.nodeType !== 1) { return 0; }
            if (elem.nodeName === "HTML" || elem.nodeName === "BODY") { return 0; }
            this.textFilterCandidates = this.getNodeText(elem);
            return 1;
        },

        getNodeText: function (elem) {
            let temp = []
            if (elem) {
                const forFn = function (ele) {
                    if (ele.childNodes.length > 0) {
                        let children = Array.from(ele.childNodes);
                        children.forEach((c) => {
                            forFn(c);
                        })
                    } else {
                        let text = ele.textContent.trim();
                        if (text) {
                            temp.push(text);
                        }

                    }
                }
                forFn(elem);
            }

            return temp;
        },

        filtersFrom: function (x, y) {
            this.textFilterCandidates.length = 0
            let elem = null;
            if (typeof x === 'number') {
                elem = this.elementFromPoint(x, y);
            } else if (x instanceof HTMLElement) {
                elem = x;
                x = undefined;
            }

            this.textFilterFromElement(elem);

            return this.textFilterCandidates.length;
        },

        showDialog: function (options) {
            this.sendMessageToIframe({
                what: 'showDialog',
                url: self.location.href,
                text: this.textFilterCandidates,
                options,
            });
        },

        elementFromPoint: function (x, y) {
            let lastX, lastY;

            if (x !== undefined) {
                lastX = x; lastY = y;
            } else if (lastX !== undefined) {
                x = lastX; y = lastY;
            } else {
                return null;
            }
            if (!this.pickerRoot) { return null; }
            const magicAttr = `${this.sessionId}-clickblind`;
            this.pickerRoot.setAttribute(magicAttr, '');
            let elems = document.elementsFromPoint(x, y);
            elems = elems.filter(ele => ele.name != 'myFrame') || [];
            let elem = elems[0];

            this.pickerRoot.removeAttribute(magicAttr);
            return elem;
        },

        highlightElementAtPoint: function (mx, my) {
            const elem = this.elementFromPoint(mx, my);
            this.highlightElements(elem ? [elem] : []);
        },

        filterElementAtPoint: function (mx, my, broad) {
            if (this.filtersFrom(mx, my) === 0) { return; }
            this.showDialog({ broad });
        },

        onKeyPressed: function (ev) {
            // Esc
            if (ev.key === 'Escape' || ev.which === 27) {
                ev.stopPropagation();
                ev.preventDefault();
                this.quitPicker();
                return;
            }
        },

        onViewportChanged: function () {
            self.highlightElements(self.targetElements, true);
        },

        startPicker: function () {
            this.pickerRoot.focus();

            self.addEventListener('scroll', self.onViewportChanged, { passive: true });
            self.addEventListener('resize', self.onViewportChanged, { passive: true });
            self.addEventListener('keydown', self.onKeyPressed, true);
        },

        quitPicker: function () {
            self.removeEventListener('scroll', self.onViewportChanged, { passive: true });
            self.removeEventListener('resize', self.onViewportChanged, { passive: true });
            self.removeEventListener('keydown', self.onKeyPressed, true);

            if (this.pickerRoot === null) { return; }

            this.pickerRoot.remove();
            this.pickerRoot = null;

            self.focus();
        },

        onDialogMessage: function (msg) {
            switch (msg.what) {
                case 'start':
                    this.startPicker();
                    if (this.targetElements.length === 0) {
                        this.highlightElements([], true);
                    }
                    break;
                case 'quitPicker':
                    this.quitPicker();
                    break;
                case 'highlightElementAtPoint':
                    this.highlightElementAtPoint(msg.mx, msg.my);
                    break;
                case 'filterElementAtPoint':
                    this.filterElementAtPoint(msg.mx, msg.my, msg.broad);
                    break;
                case 'togglePreview':
                    if (msg.state === false) {
                        this.highlightElements(this.targetElements, true);
                    }
                    break;
                default:
                    break;
            }
        },

        sendMessageToIframe: function (msg) {
            this.pickerRoot.contentWindow.postMessage(msg, this.iframeHost);
        },

        showPicker: function (success, error) {
            const self = this;
            if (this.pickerRoot) {
                return;
            }
            const pickerRoot = document.createElement('iframe');
            pickerRoot.setAttribute(this.sessionId, '');
            pickerRoot.setAttribute('name', 'myFrame');
            pickerRoot.setAttribute('src', this.iframeHost + '/picker.html')
            pickerRoot.onload = function (e) {
                if (success) {
                    success();
                }
                setTimeout(() => {
                    self.sendMessageToIframe({ what: 'connectionAccepted' })
                });
            };
            this.pickerRoot = pickerRoot;
            document.documentElement.append(pickerRoot);
        },
    }

    window.doubanPicker = doubanPicker;
})();
