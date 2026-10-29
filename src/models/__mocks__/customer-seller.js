module.exports = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  getAttributes: jest.fn(() => ({})),
};
