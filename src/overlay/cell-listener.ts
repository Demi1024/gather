import { CodeCellModel, ICellModel, ICodeCellModel } from "@jupyterlab/cells";
import { NotebookPanel } from "@jupyterlab/notebook";
import { IObservableList } from "@jupyterlab/observables";
import { UUID } from "@lumino/coreutils";
import { GatherModel } from "../model"; // model/model.ts
import { LabCell } from "../model/cell";

/**
 * Listens to cell executions and edits.
 * 监听单元格执行和编辑
 */
export class CellChangeListener {
  // 定义 listener 的 model 变量，基于 GatherModel 的 class；
  private _gatherModel: GatherModel;

  constructor(gatherModel: GatherModel, notebook: NotebookPanel) {
    this._gatherModel = gatherModel;
    this._registerCurrentCells(notebook);
    // 每当 cell 发生变化的时候，记录 cell
    notebook.content.model.cells.changed.connect(
      (_, change) => this._registerAddedCells(change),
      this
    );
  }

  // CellChangeListener 实例化后，立刻记录当前的 cell；
  private _registerCurrentCells(notebookPanel: NotebookPanel) {
    for (let i = 0; i < notebookPanel.content.model.cells.length; i++) {
      this._registerCell(notebookPanel.content.model.cells.get(i));
    }
  }

  /**
   * It's expected that this is called directly after the cell is executed.
   * 预期在单元格执行后直接调用这个函数
   */
  private _annotateCellWithExecutionInformation(cell: LabCell) {
    cell.lastExecutedText = cell.text;
    cell.executionEventId = UUID.uuid4();
  }

  // 记录活动的 cell
  private _registerCell(cell: ICellModel) {
    if (cell.type !== "code") {
      return;
    }
    /*
     * A cell will be considered edited whenever any of its contents changed, including
     * execution count, metadata, outputs, text, etc.
     * 当单元格的任何内容发生变化时，它将被认为是已编辑的，包括执行计数、元数据、输出、文本等。
     */
    cell.stateChanged.connect((changedCell, cellStateChange) => {
      // 判断变化的类型，是否为执行计数的改变
      if (
        cellStateChange.name === "executionCount" &&
        cellStateChange.newValue !== undefined &&
        cellStateChange.newValue !== null
      ) {
        // 给原本的 jupyterlab 的 cell 包装一层
        let labCell = new LabCell(changedCell as ICodeCellModel);
        /*
         * Annotate the cell before reporting to the model that it was executed, because
         * the model's listeners will need these annotations.
         * 在向模型报告单元格被执行之前注释它，因为模型的监听器将需要这些注释。
         */
        this._annotateCellWithExecutionInformation(labCell);
        this._gatherModel.lastExecutedCell = labCell;
      }
    });
    cell.contentChanged.connect((changedCell, _) => {
      if (changedCell instanceof CodeCellModel) {
        // 记录最后被编辑的 cell
        this._gatherModel.lastEditedCell = new LabCell(changedCell);
      }
    });
  }

  // 判断是新增还是删除 cell
  private _registerAddedCells(cellListChange: IObservableList.IChangedArgs<ICellModel>): void {
    if (cellListChange.type === "add" || cellListChange.type === "remove") {
      const cellModel = cellListChange.newValues[0] as ICellModel;
      if (cellListChange.type === "add") {
        this._registerCell(cellModel);
      } else if (cellListChange.type === "remove") {
        // 如果是删除 cell，则记录最后被删除的 cell ，采用实例 LabCell
        if (cellModel instanceof CodeCellModel) {
          this._gatherModel.lastDeletedCell = new LabCell(cellModel);
        }
      }
    }
  }
}
