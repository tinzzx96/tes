const router = require('express').Router();
const { listUsers, getUser, createUser, updateUser, deleteUser, bulkImportStudents, createRules, updateRules, importRules } = require('../../controllers/admin/users.controller');

router.get('/', listUsers);
router.post('/', createRules, createUser);
router.post('/import', importRules, bulkImportStudents);
router.get('/:id', getUser);
router.put('/:id', updateRules, updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
