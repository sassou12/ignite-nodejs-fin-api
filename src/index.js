//dependencies
const express = require('express');
const cors = require('cors');
const {v4: uuid} = require('uuid');
const { request, response } = require('express');

//initialize server
const app = express();

//middlewares
app.use(express.json());
app.use(cors());

//Global variables
const customers = [];

//custom middlewares
const customersAlreadyExists = (request, response, next) => {
    const customer = getCustomerByCPF(request.headers.cpf);
    if(customer) {
        return response.status(400).json({message: 'Customer already exists'});
    }
    next();
}

const verifyExistsAccountByCPF = (request, response, next) => {
    const customer = getCustomerByCPF(request.headers.cpf);
    if(!customer) {
        return response.status(400).json({message: 'Customer not found'});
    }
    request.customer = customer;
    next();
}

const verifyEnoughBalance = (request, response, next) => {
    const { amount } = request.body;
    const balance = getBalance(request.customer.statement, 0.0);
    if(balance < amount) {
        return response.status(400).json({message: 'Insufficient funds'});
    }
    next();
}

//generic functions
const getBalance = (statement, initialValue) => {
    if(statement && statement instanceof Array) {
        return statement.reduce((total, transaction) => {
            return transaction.type === 'credit' ? total + transaction.amount: total - transaction.amount;
        }, initialValue);
    }
    throw new Error('Invalid statement');
}

const getCustomerByCPF = (cpf) => {
    return customers.find(c => c.cpf === cpf);
}

//Routes
//*Account
app.post('/accounts', customersAlreadyExists, (request, response) => {
    const {cpf, name} = request.body;

    customers.push({
        id: uuid(),
        cpf,
        name,
        statement: []
    });

    return response.status(201).send();
});

app.use(verifyExistsAccountByCPF);

app.patch('/accounts', (request, response) => {
    const { name } = request.body;
    if(!name) return response.status(400).json({message: 'Name is required!.'})
    request.customer.name = name;
    return response.json({message: 'Account updated.'})
});

app.get('/accounts', (request, response) => {
    const customer = {... request.customer};
    delete customer.id;
    delete customer.statement;
    return response.json(customer);
});

app.delete('/accounts', (request, response) => {
    const {customer} = request;
    const balance = getBalance(customer.statement,0.0);

    if(balance!==0){
        return response.status(400).json({message: 'Account has balance or debit'});
    }

    const index = customers.findIndex(c => c.id === customer.id);
    customers.splice(index, 1);

    return response.json({message: 'Account closed successfully'});
});

//*Transactions
app.get('/statements', (request, response) => {
    const { date } = request.query;
    const { statement } = request.customer;

    if(date) {
        let dateFormat = new Date(date + " 00:00");
        return response.json(statement.filter(t =>t.created_at.toDateString() === dateFormat.toDateString()));
    }

    return response.json(statement);
});

app.get('/balance', (request, response) => {
    return response.json({balance: getBalance(request.customer.statement, 0)});
});

app.post('/deposit', (request, response) => {
    const {description, amount} = request.body;
    
    request.customer.statement.push({
        description,
        amount,
        created_at: new Date(),
        type: 'credit'
    });
    
    return response.status(201).send();
});

app.post('/withdraw', verifyEnoughBalance, (request, response) =>{
    const { description, amount } = request.body
    
    request.customer.statement.push({
        description,
        amount,
        created_at: new Date(),
        type: 'debit'
    });

    return response.status(201).send();
});

//starting server
app.listen(3333, ()=>console.log('Ignite - Starting server fin-api'));