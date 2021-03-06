import * as React from "react";
import {Command, GenerateMarkdownPreview, MdeState, ButtonContentOptions} from "./types";
import {getDefaultCommands} from "./commands";
import {layoutMap, LayoutMap} from "./LayoutMap";
import {ContentState, EditorState} from "draft-js";
import {getMdeStateFromDraftState} from "./util/DraftUtil";
import {MdeToolbarIcon} from "./components";

export interface ReactMdeProps {
    editorState: MdeState;
    className?: string;
    commands?: Command[][];
    buttonContentOptions?: ButtonContentOptions;
    onChange: (value: MdeState) => void;
    generateMarkdownPreview?: GenerateMarkdownPreview;
    layout?: keyof LayoutMap;
    layoutOptions?: any;
    emptyPreviewHtml?: string;
    readOnly?: boolean;
    otherProps?: any;
    onTabChange?: any;
    cleanHtml?: any;
}

export class ReactMde extends React.Component<ReactMdeProps> {
    static defaultProps: Partial<ReactMdeProps> = {
        commands: getDefaultCommands(),
        buttonContentOptions: {
            iconProvider: (name) => <MdeToolbarIcon icon={name}/>,
        },
        layout: "vertical",
        emptyPreviewHtml: "<p>&nbsp;</p>",
        readOnly: false,
    };

    handleOnChange = ({markdown, html, draftEditorState}: MdeState) => {
        const {onChange} = this.props;
        onChange({markdown, html, draftEditorState});
    }

    handleDraftStateChange = (draftEditorState: EditorState) => {
        const {generateMarkdownPreview} = this.props;
        getMdeStateFromDraftState(draftEditorState, generateMarkdownPreview).then((mdeState) => {
            this.handleOnChange({
                html: mdeState.html,
                markdown: mdeState.markdown,
                draftEditorState,
            });
        });
    }

    onTabChange = (tab) => {
        this.props.onTabChange(tab);
    }

    onCommand = (command: Command) => {
        if (!command.execute) return;
        const {draftEditorState} = this.props.editorState;
        const executedCommand = command.execute(draftEditorState);
        // When this issue is solved, probably it won't be required anymore to do an explicit type cast:
        // https://github.com/Microsoft/TypeScript/issues/1260
        if (executedCommand.constructor.name === "Promise") {
            return (executedCommand as Promise<EditorState>).then((result) => this.handleDraftStateChange(result));
        } else {
            const newEditorState = executedCommand as EditorState;
            return this.handleDraftStateChange(newEditorState);
        }
    }

    // The user is **only** supposed to pass the 'markdown' prop of the editorState. Both 'html' and 'draftEditorState'
    // are supposed to be populated by React-Mde. If 'draftEditorState' has value here, this means that the whole 'editorState'
    // has been generated by React-Mde. Otherwise, we will generate an 'initializedMdeState' and call 'handleOnChange'
    // so the user has it
    async ensureMdeStateIsInSync() {
        const {editorState, generateMarkdownPreview} = this.props;

        let initializedMdeState: MdeState;
        if (editorState) {
            if (editorState.draftEditorState) {
                // editor states with a draftEditorState are considered to be in sync already
                return;
            }
            const html = editorState.html || ((editorState.markdown && generateMarkdownPreview) ? await generateMarkdownPreview(editorState.markdown) : "");
            initializedMdeState = {
                markdown: editorState.markdown,
                html,
                draftEditorState: editorState.draftEditorState || EditorState.createWithContent(ContentState.createFromText(editorState.markdown)),
            };
        } else {
            initializedMdeState = {
                html: "",
                markdown: "",
                draftEditorState: EditorState.createEmpty(),
            };
        }
        this.handleOnChange(initializedMdeState);
    }

    async componentDidMount() {
        await this.ensureMdeStateIsInSync();
    }

    async componentDidUpdate() {
        await this.ensureMdeStateIsInSync();
    }

    render() {
        const Layout = layoutMap[this.props.layout];
        const {buttonContentOptions, commands, layoutOptions, className, emptyPreviewHtml, readOnly, otherProps, cleanHtml} = this.props;
        const {editorState} = this.props;
        let finalEditorState: MdeState = editorState;
        if (!finalEditorState || !finalEditorState.draftEditorState) {
            // This is only supposed to prevent React-Mde from receiving an empty draftEditorState. In this case,
            // componentDidMount or componentDidUpdate will call handleOnChange to pass a valid MdeState to the user
            finalEditorState = {
                html: "",
                markdown: "",
                draftEditorState: EditorState.createEmpty(),
            };
        }
        return (
            <div className={`react-mde ${className || ""}`}>
                <Layout
                    buttonContentOptions={buttonContentOptions}
                    onChange={this.handleDraftStateChange}
                    onCommand={this.onCommand}
                    commands={commands}
                    layoutOptions={layoutOptions}
                    mdeEditorState={finalEditorState}
                    emptyPreviewHtml={emptyPreviewHtml}
                    readOnly={readOnly}
                    otherProps={otherProps}
                    onTabChange={this.onTabChange}
                    cleanHtml={cleanHtml}
                />
            </div>
        );
    }
}
