import { PanelLayout } from '@phosphor/widgets';
import { Widget } from '@phosphor/widgets';
import { IRevisionModel } from './model';
import { CodeVersion } from '../codeversion';
import { GatherState } from '../gather';
import { log } from '../../utils/log';

/**
 * The class name added to revision widgets
 */
const REVISION_CLASS = 'jp-Revision';

/**
 * The class name added to headers for revision widgets.
 */
const REVISION_HEADER_CLASS = 'jp-Revision-header';

/**
 * The class name added to the container for revision buttons.
 */
const REVISION_BUTTONS_CLASS = 'jp-Revision-buttons';

/**
 * The class name added to labels on buttons.
 */
const REVISION_BUTTON_LABEL_CLASS = 'jp-Revision-button-label';

/**
 * The class name added to buttons.
 */
const REVISION_BUTTON_CLASS = 'jp-Revision-button';

/**
 * The class name added to the container of cells for a revision.
 */
const REVISION_CELLS_CLASS = 'jp-Revision-cells';

/**
 * Interface for rendering output models into HTML elements.
 */
export interface IOutputRenderer<TOutputModel> {
    /**
     * Render an HTML element for an output model.
     */
    render(outputModel: TOutputModel): HTMLElement;
}

/**
 * A widget for showing revision of an execution.
 */
export class Revision<TOutputModel> extends Widget {
    /**
     * Construct a revision.
     */
    constructor(options: Revision.IOptions<TOutputModel>) {   
        super();
        this.addClass(REVISION_CLASS);
        let model = (this.model = options.model);
        let outputRenderer = options.outputRenderer;

        let layout = (this.layout = new PanelLayout());
        
        // Add header
        let header: HTMLElement = document.createElement("h1");
        let headerText: string;
        if (this.model.isLatest) {
            headerText = "Current version";
        } else {
            
            // Get the amount of time past since execution
            let diff = (new Date()).valueOf() - this.model.timeCreated.valueOf();
            
            function relativeTime(count: number, unit: string) {
                let units = count > 1 ? unit + "s" : unit;
                return count + " " + units + " ago";
            }

            // Approximate---not exact!
            let seconds = Math.floor(diff / 1000);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            let days = Math.floor(hours / 24);
            let weeks = Math.floor(days / 7);
            let months = Math.floor(weeks / 4);  // approximate. Need calendar to be exact

            if (months > 0) headerText = relativeTime(months, "month");
            else if (weeks > 0) headerText = relativeTime(weeks, "week");
            else if (days > 0) headerText = relativeTime(days, "day");
            else if (hours > 0) headerText = relativeTime(hours, "hour");
            else if (minutes > 0) headerText = relativeTime(minutes, "minute");
            else if (seconds > 0) headerText = relativeTime(seconds, "second");
            else headerText = "Milliseconds ago";
        }

        header.textContent = headerText;
        let headerWidget: Widget = new Widget({ node: header });
        headerWidget.addClass(REVISION_HEADER_CLASS);
        layout.addWidget(headerWidget);

        // Add buttons for gathering
        let buttons = new Widget({ node: document.createElement("div") });
        buttons.addClass(REVISION_BUTTONS_CLASS);
        buttons.layout = new PanelLayout();

        let notebookButton = new Widget({ node: document.createElement("button") });
        notebookButton.addClass(REVISION_BUTTON_CLASS);
        let notebookLabel = document.createElement("i");
        notebookLabel.classList.add("fa-book", "fa");
        let notebookText = document.createElement("span");
        notebookText.classList.add(REVISION_BUTTON_LABEL_CLASS);
        notebookText.textContent = "Open in notebook";
        notebookLabel.appendChild(notebookText);
        notebookButton.node.appendChild(notebookLabel);
        notebookButton.node.onclick = () => {
            log("Revision browser: Gathering version to notebook", {
                slice: this.model.slice,
                versionIndex: this.model.versionIndex,
                isLatest: this.model.isLatest
            });
            let gatherModel = this.model.gatherModel;
            gatherModel.addChosenSlices(this.model.slice);
            gatherModel.requestStateChange(GatherState.GATHER_TO_NOTEBOOK);
        };
        (buttons.layout as PanelLayout).addWidget(notebookButton);

        let copyButton = new Widget({ node: document.createElement("button") });
        copyButton.addClass(REVISION_BUTTON_CLASS);
        let copyLabel = document.createElement("i");
        copyLabel.classList.add("fa-clipboard", "fa");
        let copyText = document.createElement("span");
        copyText.classList.add(REVISION_BUTTON_LABEL_CLASS);
        copyText.textContent = "Copy to clipboard";
        copyLabel.appendChild(copyText);
        copyButton.node.appendChild(copyLabel);
        copyButton.node.onclick = () => {
            log("Revision browser: Gathering version to clipboard", {
                slice: this.model.slice,
                versionIndex: this.model.versionIndex,
                isLatest: this.model.isLatest
            });
            let gatherModel = this.model.gatherModel;
            gatherModel.addChosenSlices(this.model.slice);
            gatherModel.requestStateChange(GatherState.GATHER_TO_CLIPBOARD);
        };
        (buttons.layout as PanelLayout).addWidget(copyButton);

        layout.addWidget(buttons);

        // Add the revision's code
        let cellsWidget = new Widget({ node: document.createElement("div") });
        cellsWidget.addClass(REVISION_CELLS_CLASS);
        let cellsLayout = (cellsWidget.layout = new PanelLayout());
        layout.addWidget(cellsWidget);

        cellsLayout.addWidget(new CodeVersion({
            model: model.source,
        }));

        if (model.output) {
            let outputElement = outputRenderer.render(model.output);
            if (outputElement) {
                cellsLayout.addWidget(new Widget({
                    node: outputElement
                }));
            }
        }
    }

    /**
     * The model used by the widget.
     */
    readonly model: IRevisionModel<TOutputModel>;
}

/**
 * A namespace for `Revision` statics.
 */
export namespace Revision {
    /**
     * The options used to create a `Revision`.
     */
    export interface IOptions<TOutputModel> {
        /**
         * The model used by the widget.
         */
        model: IRevisionModel<TOutputModel>;

        /**
         * The output renderer for this widget.
         */
        outputRenderer: IOutputRenderer<TOutputModel>;
    }
}