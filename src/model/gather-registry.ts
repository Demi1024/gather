import { INotebookModel, INotebookTracker } from '@jupyterlab/notebook';
import { UUID } from '@lumino/coreutils';
import { log } from 'util';
import { GatherModel } from '.';

/**
 * @description: 为选中的notebook获取记录中的信息
 * @param {*}
 * @return {*}
 */

export function getGatherModelForActiveNotebook(
  notebooks: INotebookTracker,
  gatherModelRegistry: GatherModelRegistry
): GatherModel | null {
  let activeNotebook = notebooks.currentWidget;
  if (activeNotebook == null) return null;
  return gatherModelRegistry.getGatherModel(activeNotebook.model);
}

/**
 * Registry of all gather models created for all open notebooks.
 */
/**
 * @description: 为所有打开的笔记本创建的所有收集模型的注册表。
 * 注册表为一个字典，采用键值对的方式存储
 * @param {*}
 * @return {*}
 */
export class GatherModelRegistry {
  /**
   * Returns null is notebook ID is in an unexpected format.
   */
  // 获取某个 model 的id，取返回值
  _getNotebookId(notebookModel: INotebookModel): string | null {
    const METADATA_NOTEBOOK_ID_KEY = 'uuid';
    if (!notebookModel.metadata.has(METADATA_NOTEBOOK_ID_KEY)) {
      // 如果没有id，则给这个model 生成一个，保存在 model 的元数据中
      notebookModel.metadata.set(METADATA_NOTEBOOK_ID_KEY, UUID.uuid4());
    }
    // 从元数据中获取id
    let id = notebookModel.metadata.get(METADATA_NOTEBOOK_ID_KEY);
    if (!(typeof id == 'string')) {
      log('Unexpected notebook ID format ' + id);
      return null;
    }
    return id;
  }

  /**
   * Returns false if storage of gather model failed.
   */
  // 把操作过的 model 存储在字典中
  addGatherModel(
    notebookModel: INotebookModel,
    gatherModel: GatherModel
  ): boolean {
    // 获取 notebookModel 的 id，判断是否存在于记录中
    let notebookId = this._getNotebookId(notebookModel);
    if (notebookId == null) return false;
    this._gatherModels[notebookId] = gatherModel;
    return true;
  }

  /**
   * Returns null if no gather model found for this notebook.
   */
  /**
   * @description: 在字典中找到目标 model
   * @param {INotebookModel} notebookModel
   * @return {*}
   */
  getGatherModel(notebookModel: INotebookModel): GatherModel | null {
    let notebookId = this._getNotebookId(notebookModel);
    if (notebookId == null) return null;
    if (this._gatherModels.hasOwnProperty(notebookId)) {
      return this._gatherModels[notebookId];
    }
    return null;
  }

  private _gatherModels: { [notebookId: string]: GatherModel } = {}; // 记录notebook 模型 的字典
}
