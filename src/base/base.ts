import BaseUtils from './utils';
import api from '../constants/api';
import url from '../constants/url';
import Requests from '../utils/request';
import { isObject } from '../utils/object';
import { Action, ActionTypes } from '../types/action';
import { DetaType, ArrayType, ObjectType } from '../types/basic';

import {
  GetResponse,
  PutResponse,
  DeleteResponse,
  InsertResponse,
  UpdateResponse,
  PutManyResponse,
} from '../types/response';

export default class Base {
  private requests: Requests;

  public util: BaseUtils;

  /**
   * Base constructor
   *
   * @param {string} projectKey
   * @param {string} baseName
   */
  constructor(projectKey: string, baseName: string) {
    const baseURL = url.BASE_HOST_URL.replace(':base_name', baseName);
    this.requests = new Requests(projectKey, baseURL);
    this.util = new BaseUtils();
  }

  /**
   * put data on base
   *
   * @param {DetaType} data
   * @param {string} [key]
   * @returns {Promise<PutResponse>}
   */
  public async put(data: DetaType, key?: string): Promise<PutResponse> {
    const payload: ObjectType[] = [
      {
        ...(isObject(data) ? (data as ObjectType) : { value: data }),
        ...(key && { key }),
      },
    ];

    const { response, error } = await this.requests.put(api.PUT_ITEMS, {
      items: payload,
    });
    if (error) {
      throw error;
    }

    return response?.processed?.items?.[0] || null;
  }

  /**
   * get data from base
   *
   * @param {string} key
   * @returns {Promise<GetResponse>}
   */
  public async get(key: string): Promise<GetResponse> {
    const trimedKey = key.trim();
    if (!trimedKey.length) {
      throw new Error('Key is empty');
    }

    const encodedKey = encodeURIComponent(trimedKey);

    const { status, response, error } = await this.requests.get(
      api.GET_ITEMS.replace(':key', encodedKey)
    );

    if (error && status !== 404) {
      throw error;
    }

    if (status === 200) {
      return response;
    }

    return null;
  }

  /**
   * delete data on base
   *
   * @param {string} key
   * @returns {Promise<DeleteResponse>}
   */
  public async delete(key: string): Promise<DeleteResponse> {
    const trimedKey = key.trim();
    if (!trimedKey.length) {
      throw new Error('Key is empty');
    }

    const encodedKey = encodeURIComponent(trimedKey);

    const { error } = await this.requests.delete(
      api.DELETE_ITEMS.replace(':key', encodedKey)
    );
    if (error) {
      throw error;
    }

    return null;
  }

  /**
   * insert data on base
   *
   * @param {DetaType} data
   * @param {string} [key]
   * @returns {Promise<InsertResponse>}
   */
  public async insert(data: DetaType, key?: string): Promise<InsertResponse> {
    const payload: ObjectType = {
      ...(isObject(data) ? (data as ObjectType) : { value: data }),
      ...(key && { key }),
    };

    const { status, response, error } = await this.requests.post(
      api.INSERT_ITEMS,
      {
        item: payload,
      }
    );
    if (error && status === 409) {
      throw new Error(`Item with key ${key} already exists`);
    }
    if (error) {
      throw error;
    }

    return response;
  }

  /**
   * putMany data on base
   *
   * @param {DetaType[]} items
   * @returns {Promise<PutManyResponse>}
   */
  public async putMany(items: DetaType[]): Promise<PutManyResponse> {
    if (!(items instanceof Array)) {
      throw new Error('Items must be an array');
    }

    if (items.length > 25) {
      throw new Error("We can't put more than 25 items at a time");
    }

    const payload: ObjectType[] = items.map((item) =>
      isObject(item) ? (item as ObjectType) : { value: item }
    );

    const { response, error } = await this.requests.put(api.PUT_ITEMS, {
      items: payload,
    });
    if (error) {
      throw error;
    }

    return response;
  }

  /**
   * update data on base
   *
   * @param {ObjectType} updates
   * @param {string} key
   * @returns {Promise<UpdateResponse>}
   */
  public async update(
    updates: ObjectType,
    key: string
  ): Promise<UpdateResponse> {
    const trimedKey = key.trim();
    if (!trimedKey.length) {
      throw new Error('Key is empty');
    }

    const payload: {
      set: ObjectType;
      increment: ObjectType;
      append: ObjectType;
      prepend: ObjectType;
      delete: ArrayType;
    } = {
      set: {},
      increment: {},
      append: {},
      prepend: {},
      delete: [],
    };

    Object.entries(updates).forEach(([objKey, objValue]) => {
      const action =
        objValue instanceof Action
          ? objValue
          : new Action(ActionTypes.Set, objValue);

      const { operation, value } = action;
      switch (operation) {
        case ActionTypes.Trim: {
          payload.delete.push(objKey);
          break;
        }
        default: {
          payload[operation][objKey] = value;
        }
      }
    });

    const encodedKey = encodeURIComponent(trimedKey);
    const { error } = await this.requests.patch(
      api.PATCH_ITEMS.replace(':key', encodedKey),
      payload
    );
    if (error) {
      throw error;
    }

    return null;
  }

  /**
   * fetch data from base
   *
   * @param {DetaType} [query]
   * @param {number} [pages]
   * @param {number} [buffer]
   * @returns {Promise<UpdateResponse>}
   */
  public async *fetch(
    query: DetaType = [],
    pages: number = 10,
    buffer?: number
  ): AsyncGenerator<ObjectType[], void, void> {
    let lastValue = '';
    const q = Array.isArray(query) ? query : [query];

    for (let idx = 0; idx < pages; idx += 1) {
      const payload = {
        query: q,
        limit: buffer,
        last: lastValue,
      };

      const { response, error } = await this.requests.post(
        api.QUERY_ITEMS,
        payload
      );
      if (error) {
        throw error;
      }

      const { paging, items } = response;
      const { last } = paging;

      yield items;

      lastValue = last;

      if (!lastValue) {
        break;
      }
    }
  }
}
