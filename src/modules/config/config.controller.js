import { ConfigService } from './config.service.js';

const configService = new ConfigService();

export const listAll = async (req, res, next) => {
  try {
    const result = await configService.listAll();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const config = await configService.getOne(req.params.key);
    res.status(200).json({ success: true, config });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    const config = await configService.create(key, value);
    res.status(201).json({ success: true, message: `Config "${key}" created.`, config });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { value } = req.body;
    const config = await configService.update(req.params.key, value);
    res.status(200).json({ success: true, message: `Config "${req.params.key}" updated.`, config });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await configService.remove(req.params.key);
    res.status(200).json({ success: true, message: `Config "${req.params.key}" deleted.` });
  } catch (error) {
    next(error);
  }
};
